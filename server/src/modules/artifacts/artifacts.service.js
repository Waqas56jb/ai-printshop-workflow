import crypto from 'node:crypto';
import path from 'node:path';
import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';
import * as customersService from '../customers/customers.service.js';

const BUCKET = 'client-artifacts';

function sanitizeFileName(name) {
  return path.basename(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function newToken() {
  return crypto.randomBytes(16).toString('hex');
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

export function joinNetworkPath(root, relative) {
  const base = String(root || '').trim().replace(/[\\/]+$/, '');
  const rel = String(relative || '')
    .trim()
    .replace(/^[\\/]+/, '')
    .replace(/\//g, '\\');
  if (!base && !rel) return null;
  if (!base) return rel;
  if (!rel) return base;
  if (rel.toLowerCase().startsWith(base.toLowerCase())) return rel;
  return `${base}\\${rel}`;
}

const CUSTOMER_FOLDERS_ROOT = 'P:\\CUSTOMER FOLDERS';

function sanitizeFolderSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function defaultNetworkFolder(customer) {
  const label = (sanitizeFolderSegment(customer?.company || customer?.name) || 'CUSTOMER').toUpperCase();
  return `${CUSTOMER_FOLDERS_ROOT}\\${label}`;
}

export function resolveNetworkFolder(customer, override) {
  const fromOverride = String(override || '').trim().replace(/\\+/g, '\\');
  const fromCustomer = String(customer?.network_folder || '').trim().replace(/\\+/g, '\\');
  return fromOverride || fromCustomer || defaultNetworkFolder(customer);
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const found = (buckets || []).find((row) => row.name === BUCKET);
  if (!found) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 25 * 1024 * 1024 });
    if (error && !/already exists/i.test(error.message)) {
      throw new ApiError(500, error.message);
    }
    return;
  }
  if (!found.public) {
    await supabase.storage.updateBucket(BUCKET, { public: true });
  }
}

export async function ensureShareToken(customerId) {
  const customer = await customersService.getCustomer(customerId);
  if (customer.share_token) return customer.share_token;
  const share_token = newToken();
  unwrap(
    await supabase.from('customers').update({ share_token }).eq('id', customerId),
    'Failed to create share link'
  );
  return share_token;
}

export async function rotateShareToken(customerId) {
  await customersService.getCustomer(customerId);
  const share_token = newToken();
  unwrap(
    await supabase.from('customers').update({ share_token }).eq('id', customerId),
    'Failed to rotate share link'
  );
  return share_token;
}

export async function listArtifacts(customerId) {
  await customersService.getCustomer(customerId);
  return (
    unwrap(
      await supabase
        .from('customer_artifacts')
        .select('*')
        .eq('customer_id', customerId)
        .order('folder_path', { ascending: true })
        .order('created_at', { ascending: true }),
      'Failed to list artifacts'
    ) || []
  );
}

export async function uploadArtifacts(customerId, files, userId, extras = {}) {
  const customer = await customersService.getCustomer(customerId);
  if (!files?.length) {
    throw new ApiError(400, 'At least one file is required');
  }
  await ensureBucket();
  await ensureShareToken(customerId);
  const paths = asList(extras.paths);
  const skus = asList(extras.skus);
  const defaultSku = typeof extras.sku === 'string' ? extras.sku.trim() : '';
  const networkRoot = resolveNetworkFolder(customer, extras.network_folder);
  const proof_status = ['revision', 'proof', 'approved', 'print_ready'].includes(extras.proof_status)
    ? extras.proof_status
    : 'revision';

  if (networkRoot && networkRoot !== customer.network_folder) {
    await supabase.from('customers').update({ network_folder: networkRoot }).eq('id', customerId);
  }

  const existing = await listArtifacts(customerId);
  const saved = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const relative = String(paths[i] || file.originalname || 'file').replace(/\\/g, '/');
    const folder_path = relative.includes('/') ? relative.split('/').slice(0, -1).join('/') : null;
    const sameName = existing.filter((row) => row.file_name === file.originalname);
    const revision = Math.max(0, ...sameName.map((row) => Number(row.revision) || 0)) + 1;
    const network_path = joinNetworkPath(networkRoot, relative.replace(/\//g, '\\'));
    const safeName = sanitizeFileName(file.originalname);
    const filePath = `${customerId}/${folder_path ? `${folder_path}/` : ''}${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: false,
    });
    if (uploadError) {
      throw new ApiError(500, uploadError.message);
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    const payload = {
      customer_id: customerId,
      file_name: file.originalname,
      file_path: filePath,
      file_url: publicData.publicUrl,
      file_type: file.mimetype || null,
      size_bytes: file.size,
      sku: (skus[i] || defaultSku || '').trim() || null,
      folder_path,
      network_path,
      revision,
      proof_status,
      uploaded_by: userId,
    };
    const first = await supabase.from('customer_artifacts').insert(payload).select('*').single();
    if (first.error && /network_path|revision|proof_status/i.test(first.error.message || '')) {
      delete payload.network_path;
      delete payload.revision;
      delete payload.proof_status;
      saved.push(unwrap(await supabase.from('customer_artifacts').insert(payload).select('*').single(), 'Failed to save artifact'));
    } else {
      saved.push(unwrap(first, 'Failed to save artifact'));
    }
  }

  return saved;
}

export async function updateArtifact(id, payload) {
  const current = unwrap(
    await supabase.from('customer_artifacts').select('*').eq('id', id).maybeSingle(),
    'Failed to load artifact'
  );
  if (!current) throw new ApiError(404, 'Artifact not found');
  return unwrap(
    await supabase
      .from('customer_artifacts')
      .update({
        sku: payload.sku === undefined ? current.sku : payload.sku || null,
        folder_path: payload.folder_path === undefined ? current.folder_path : payload.folder_path || null,
        network_path: payload.network_path === undefined ? current.network_path : payload.network_path || null,
        revision: payload.revision === undefined ? current.revision : payload.revision,
        proof_status: payload.proof_status === undefined ? current.proof_status : payload.proof_status,
      })
      .eq('id', id)
      .select('*')
      .single(),
    'Failed to update artifact'
  );
}

export async function deleteArtifact(id) {
  const current = unwrap(
    await supabase.from('customer_artifacts').select('*').eq('id', id).maybeSingle(),
    'Failed to load artifact'
  );
  if (!current) throw new ApiError(404, 'Artifact not found');
  await supabase.storage.from(BUCKET).remove([current.file_path]);
  unwrap(await supabase.from('customer_artifacts').delete().eq('id', id), 'Failed to delete artifact');
  return { id };
}

function isImage(file) {
  const type = (file.file_type || '').toLowerCase();
  const name = (file.file_name || '').toLowerCase();
  return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name);
}

export async function getSharePack(token) {
  const value = String(token || '').trim();
  if (!value) throw new ApiError(404, 'Client pack not found');

  const customer = unwrap(
    await supabase.from('customers').select('*').eq('share_token', value).maybeSingle(),
    'Failed to load client pack'
  );
  if (!customer) throw new ApiError(404, 'Client pack not found');

  const [artifacts, jobs] = await Promise.all([
    listArtifacts(customer.id),
    unwrap(
      await supabase
        .from('jobs')
        .select(
          `
          id, job_number, title, product_type, print_type, quantity, size_details, price, priority, due_date, status,
          stage:stages!stage_id(id, name, color),
          artworks:job_artworks(id, file_name, file_url, file_type, is_approved, version, network_path)
        `
        )
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false }),
      'Failed to load client jobs'
    ),
  ]);

  return {
    customer: {
      name: customer.name,
      company: customer.company,
      phone: customer.phone,
      email: customer.email,
      notes: customer.notes,
      network_folder: customer.network_folder,
    },
    artifacts: (artifacts || []).map((row) => ({
      ...row,
      kind: isImage(row) ? 'image' : (row.file_type || '').includes('pdf') || /\.pdf$/i.test(row.file_name) ? 'pdf' : 'file',
      saved_in: row.network_path || `${BUCKET}/${row.file_path}`,
    })),
    jobs: (jobs || []).map((job) => ({
      ...job,
      artworks: job.artworks || [],
    })),
  };
}
