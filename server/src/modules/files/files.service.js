import crypto from 'node:crypto';
import path from 'node:path';
import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';
import { emitJobUpdated } from '../../sockets/events.js';
import * as artworkService from '../artwork/artwork.service.js';
import { isArtworkFile } from '../artwork/artwork.upload.js';

// The Files explorer is a view over real records:
//   ""          root      → one folder per customer (with jobs or files) + shop folders + loose files
//   "c:<id>"    customer  → one folder per job + the customer's own folders + loose files
//   "j:<id>"    job       → that job's artworks (the same files the job card and the TV show)
//   "f:<id>"    folder    → a folder someone made: sub-folders + files
// Item ids say what they are: c:/j: (virtual folders), f: folder, a: job artwork, s: shop file.

const BUCKET = 'shop-files';
const SIGNED_SECONDS = 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseRef(value) {
  const raw = String(value || '').trim();
  if (!raw) return { kind: 'root', id: null };
  const [prefix, id] = raw.split(':');
  const kinds = { c: 'customer', j: 'job', f: 'folder', a: 'artwork', s: 'shop' };
  if (!kinds[prefix] || !UUID.test(id || '')) throw new ApiError(400, 'Unknown folder or file');
  return { kind: kinds[prefix], id };
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function jobFolderName(job) {
  return [job.job_number, job.title].filter(Boolean).join(' ');
}

function countBy(rows, key) {
  return (rows || []).reduce((acc, row) => {
    if (row[key]) acc.set(row[key], (acc.get(row[key]) || 0) + 1);
    return acc;
  }, new Map());
}

function artworkItem(row) {
  return {
    id: `a:${row.id}`,
    type: 'file',
    name: row.file_name,
    file_type: row.file_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
    url: row.file_url,
    job_id: row.job_id,
  };
}

async function shopFileItems(rows) {
  if (!rows?.length) return [];
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((row) => row.file_path), SIGNED_SECONDS);
  const urlByPath = new Map((signed || []).map((item) => [item.path, item.signedUrl]));
  return rows.map((row) => ({
    id: `s:${row.id}`,
    type: 'file',
    name: row.file_name,
    file_type: row.file_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
    url: urlByPath.get(row.file_path) || null,
  }));
}

async function folderItems(rows) {
  if (!rows?.length) return [];
  const ids = rows.map((row) => row.id);
  const [subs, files] = await Promise.all([
    supabase.from('folders').select('parent_id').in('parent_id', ids),
    supabase.from('shop_files').select('folder_id').in('folder_id', ids),
  ]);
  const subCount = countBy(unwrap(subs, 'Failed to count folders'), 'parent_id');
  const fileCount = countBy(unwrap(files, 'Failed to count files'), 'folder_id');
  return rows
    .map((row) => {
      const folders = subCount.get(row.id) || 0;
      const filesIn = fileCount.get(row.id) || 0;
      const parts = [folders ? plural(folders, 'folder') : null, plural(filesIn, 'file')].filter(Boolean);
      return { id: `f:${row.id}`, type: 'folder', name: row.name, sub: parts.join(' · '), auto: false };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getCustomer(id) {
  const row = unwrap(
    await supabase.from('customers').select('id, name').eq('id', id).maybeSingle(),
    'Failed to load customer'
  );
  if (!row) throw new ApiError(404, 'That customer is no longer here');
  return row;
}

async function getJob(id) {
  const row = unwrap(
    await supabase
      .from('jobs')
      .select('id, job_number, title, customer_id, customer:customers!customer_id(id, name)')
      .eq('id', id)
      .maybeSingle(),
    'Failed to load job'
  );
  if (!row) throw new ApiError(404, 'That job is no longer here');
  return row;
}

async function getFolder(id) {
  const row = unwrap(await supabase.from('folders').select('*').eq('id', id).maybeSingle(), 'Failed to load folder');
  if (!row) throw new ApiError(404, 'That folder is no longer here');
  return row;
}

async function folderTrail(folder) {
  const trail = [];
  let current = folder;
  for (let depth = 0; current && depth < 20; depth += 1) {
    trail.unshift({ path: `f:${current.id}`, name: current.name });
    current = current.parent_id ? await getFolder(current.parent_id) : null;
  }
  if (folder.customer_id) {
    const customer = await getCustomer(folder.customer_id);
    trail.unshift({ path: `c:${customer.id}`, name: customer.name });
  }
  return trail;
}

const ROOT_CRUMB = { path: '', name: 'All customers' };

async function listRoot() {
  const [customersRes, jobsRes, filesRes, foldersRes, looseRes] = await Promise.all([
    supabase.from('customers').select('id, name'),
    supabase.from('jobs').select('customer_id'),
    supabase.from('shop_files').select('customer_id').not('customer_id', 'is', null),
    supabase.from('folders').select('*').is('customer_id', null).is('parent_id', null),
    supabase.from('shop_files').select('*').is('customer_id', null).is('folder_id', null).order('created_at', { ascending: false }),
  ]);
  const jobCount = countBy(unwrap(jobsRes, 'Failed to count jobs'), 'customer_id');
  const fileCount = countBy(unwrap(filesRes, 'Failed to count files'), 'customer_id');
  const customers = (unwrap(customersRes, 'Failed to list customers') || [])
    .filter((row) => jobCount.get(row.id) || fileCount.get(row.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => {
      const jobs = jobCount.get(row.id) || 0;
      const files = fileCount.get(row.id) || 0;
      return {
        id: `c:${row.id}`,
        type: 'folder',
        name: row.name,
        sub: [jobs ? plural(jobs, 'job') : null, files ? plural(files, 'file') : null].filter(Boolean).join(' · '),
        auto: true,
      };
    });
  return {
    crumbs: [ROOT_CRUMB],
    items: [
      ...(await folderItems(unwrap(foldersRes, 'Failed to list folders'))),
      ...customers,
      ...(await shopFileItems(unwrap(looseRes, 'Failed to list files'))),
    ],
    can_new_folder: true,
    can_upload: true,
  };
}

async function listCustomer(customerId) {
  const customer = await getCustomer(customerId);
  const [jobsRes, foldersRes, looseRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, job_number, title, artworks:job_artworks(id)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    supabase.from('folders').select('*').eq('customer_id', customerId).is('parent_id', null),
    supabase
      .from('shop_files')
      .select('*')
      .eq('customer_id', customerId)
      .is('folder_id', null)
      .order('created_at', { ascending: false }),
  ]);
  const jobs = (unwrap(jobsRes, 'Failed to list jobs') || []).map((job) => ({
    id: `j:${job.id}`,
    type: 'folder',
    name: jobFolderName(job),
    sub: plural(job.artworks?.length || 0, 'file'),
    auto: true,
    job: true,
  }));
  return {
    crumbs: [ROOT_CRUMB, { path: `c:${customer.id}`, name: customer.name }],
    items: [
      ...jobs,
      ...(await folderItems(unwrap(foldersRes, 'Failed to list folders'))),
      ...(await shopFileItems(unwrap(looseRes, 'Failed to list files'))),
    ],
    can_new_folder: true,
    can_upload: true,
  };
}

async function listJob(jobId) {
  const job = await getJob(jobId);
  const artworks = unwrap(
    await supabase.from('job_artworks').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
    'Failed to list job files'
  );
  const crumbs = [ROOT_CRUMB];
  if (job.customer) crumbs.push({ path: `c:${job.customer.id}`, name: job.customer.name });
  crumbs.push({ path: `j:${job.id}`, name: jobFolderName(job) });
  return {
    crumbs,
    items: (artworks || []).map(artworkItem),
    job_id: job.id,
    can_new_folder: false,
    can_upload: true,
  };
}

async function listFolder(folderId) {
  const folder = await getFolder(folderId);
  const [foldersRes, filesRes, trail] = await Promise.all([
    supabase.from('folders').select('*').eq('parent_id', folderId),
    supabase.from('shop_files').select('*').eq('folder_id', folderId).order('created_at', { ascending: false }),
    folderTrail(folder),
  ]);
  return {
    crumbs: [ROOT_CRUMB, ...trail],
    items: [
      ...(await folderItems(unwrap(foldersRes, 'Failed to list folders'))),
      ...(await shopFileItems(unwrap(filesRes, 'Failed to list files'))),
    ],
    can_new_folder: true,
    can_upload: true,
  };
}

export async function list(pathRef) {
  const ref = parseRef(pathRef);
  const result =
    ref.kind === 'root'
      ? await listRoot()
      : ref.kind === 'customer'
        ? await listCustomer(ref.id)
        : ref.kind === 'job'
          ? await listJob(ref.id)
          : ref.kind === 'folder'
            ? await listFolder(ref.id)
            : null;
  if (!result) throw new ApiError(400, 'That is a file, not a folder');
  return { path: pathRef || '', ...result };
}

// Where new things go when created inside `pathRef`.
async function placeFor(pathRef) {
  const ref = parseRef(pathRef);
  if (ref.kind === 'root') return { customer_id: null, folder_id: null };
  if (ref.kind === 'customer') {
    await getCustomer(ref.id);
    return { customer_id: ref.id, folder_id: null };
  }
  if (ref.kind === 'folder') {
    const folder = await getFolder(ref.id);
    return { customer_id: folder.customer_id, folder_id: folder.id };
  }
  if (ref.kind === 'job') return { job_id: ref.id };
  throw new ApiError(400, 'Choose a folder first');
}

export async function createFolder(pathRef, rawName) {
  const name = String(rawName || '').trim();
  if (!name) throw new ApiError(400, 'Please type a folder name');
  const place = await placeFor(pathRef);
  if (place.job_id) throw new ApiError(400, 'A job folder only holds that job’s files');
  let query = supabase.from('folders').select('id, name');
  query = place.folder_id ? query.eq('parent_id', place.folder_id) : query.is('parent_id', null);
  query = place.customer_id ? query.eq('customer_id', place.customer_id) : query.is('customer_id', null);
  const siblings = unwrap(await query, 'Failed to check folders') || [];
  if (siblings.some((row) => row.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, `There is already a folder called ${name} here`);
  }
  const created = unwrap(
    await supabase
      .from('folders')
      .insert({ name, customer_id: place.customer_id, parent_id: place.folder_id })
      .select('*')
      .single(),
    'Failed to make the folder'
  );
  return (await folderItems([created]))[0];
}

function safeName(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function upload(pathRef, files, user) {
  if (!files?.length) throw new ApiError(400, 'Choose at least one file');
  const place = await placeFor(pathRef);

  if (place.job_id) {
    // Inside a job folder: these ARE the job's files — on the job card and the TV.
    const bad = files.find((file) => !isArtworkFile(file));
    if (bad) throw new ApiError(400, `${bad.originalname}: job files must be pictures, PDF, AI or SVG`);
    const items = [];
    for (const file of files) {
      const artwork = await artworkService.uploadArtwork(place.job_id, file, user.id);
      // The panel has no separate approve step (same as "Add file" on a job).
      const approved = await artworkService.approveArtwork(artwork.id).catch(() => artwork);
      items.push(artworkItem(approved));
    }
    return items;
  }

  const scope = place.folder_id || place.customer_id || 'shop';
  const rows = [];
  for (const file of files) {
    const filePath = `${scope}/${crypto.randomUUID()}-${safeName(file.originalname)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (error) throw new ApiError(500, `${file.originalname}: ${error.message}`);
    rows.push(
      unwrap(
        await supabase
          .from('shop_files')
          .insert({
            folder_id: place.folder_id,
            customer_id: place.customer_id,
            file_name: file.originalname,
            file_path: filePath,
            file_type: file.mimetype,
            size_bytes: file.size,
            uploaded_by: user.id,
          })
          .select('*')
          .single(),
        'Failed to save the file'
      )
    );
  }
  return shopFileItems(rows);
}

const MIRROR_MESSAGE = 'This folder matches a real customer or job, so it can’t be changed here';

export async function rename(itemId, rawName) {
  const name = String(rawName || '').trim();
  if (!name) throw new ApiError(400, 'Please type a name');
  const ref = parseRef(itemId);
  if (ref.kind === 'customer' || ref.kind === 'job') throw new ApiError(400, MIRROR_MESSAGE);
  if (ref.kind === 'folder') {
    const folder = await getFolder(ref.id);
    unwrap(await supabase.from('folders').update({ name }).eq('id', folder.id), 'Failed to rename');
    return { id: itemId, name };
  }
  if (ref.kind === 'artwork') {
    const row = unwrap(
      await supabase.from('job_artworks').update({ file_name: name }).eq('id', ref.id).select('*').maybeSingle(),
      'Failed to rename'
    );
    if (!row) throw new ApiError(404, 'That file is no longer here');
    emitJobUpdated({ id: row.job_id, artwork: row });
    return { id: itemId, name };
  }
  const row = unwrap(
    await supabase.from('shop_files').update({ file_name: name }).eq('id', ref.id).select('id').maybeSingle(),
    'Failed to rename'
  );
  if (!row) throw new ApiError(404, 'That file is no longer here');
  return { id: itemId, name };
}

export async function remove(itemId, user) {
  const ref = parseRef(itemId);
  if (ref.kind === 'customer' || ref.kind === 'job') throw new ApiError(400, MIRROR_MESSAGE);
  if (ref.kind === 'artwork') {
    await artworkService.deleteArtwork(ref.id, user);
    return { id: itemId };
  }
  if (ref.kind === 'folder') {
    const folder = await getFolder(ref.id);
    const [subs, files] = await Promise.all([
      supabase.from('folders').select('id').eq('parent_id', folder.id).limit(1),
      supabase.from('shop_files').select('id').eq('folder_id', folder.id).limit(1),
    ]);
    if (unwrap(subs, 'Failed to check folder')?.length || unwrap(files, 'Failed to check folder')?.length) {
      throw new ApiError(409, `Empty ${folder.name} first`);
    }
    unwrap(await supabase.from('folders').delete().eq('id', folder.id), 'Failed to delete folder');
    return { id: itemId };
  }
  const row = unwrap(
    await supabase.from('shop_files').select('*').eq('id', ref.id).maybeSingle(),
    'Failed to load file'
  );
  if (!row) throw new ApiError(404, 'That file is no longer here');
  await supabase.storage.from(BUCKET).remove([row.file_path]);
  unwrap(await supabase.from('shop_files').delete().eq('id', row.id), 'Failed to delete file');
  return { id: itemId };
}

export async function downloadUrl(itemId) {
  const ref = parseRef(itemId);
  const table = ref.kind === 'artwork' ? 'job_artworks' : ref.kind === 'shop' ? 'shop_files' : null;
  if (!table) throw new ApiError(400, 'Only files can be downloaded');
  const row = unwrap(
    await supabase.from(table).select('file_name, file_path').eq('id', ref.id).maybeSingle(),
    'Failed to load file'
  );
  if (!row) throw new ApiError(404, 'That file is no longer here');
  const { data, error } = await supabase.storage
    .from(ref.kind === 'artwork' ? 'artworks' : BUCKET)
    .createSignedUrl(row.file_path, SIGNED_SECONDS, { download: row.file_name });
  if (error) throw new ApiError(500, error.message);
  return { url: data.signedUrl, name: row.file_name };
}
