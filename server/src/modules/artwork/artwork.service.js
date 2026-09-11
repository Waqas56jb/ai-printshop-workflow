import crypto from 'node:crypto';
import path from 'node:path';
import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';
import { emitJobUpdated } from '../../sockets/events.js';
import * as jobsService from '../jobs/jobs.service.js';

function sanitizeFileName(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveNetworkPath(raw, fileName) {
  const base = String(raw || '').trim().replace(/[\\/]+$/, '');
  if (!base) return null;
  const last = base.split(/[\\/]/).pop() || '';
  if (/\.[a-z0-9]{2,8}$/i.test(last)) return base;
  return `${base}\\${fileName}`;
}

export async function listArtworks(jobId) {
  await jobsService.getJobRow(jobId);
  return unwrap(
    await supabase
      .from('job_artworks')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false }),
    'Failed to list artworks'
  );
}

export async function uploadArtwork(jobId, file, userId, extras = {}) {
  await jobsService.getJobRow(jobId);
  if (!file) {
    throw new ApiError(400, 'File is required');
  }

  const existing = await listArtworks(jobId);
  const version = (existing[0]?.version || 0) + 1;
  const safeName = sanitizeFileName(file.originalname);
  const filePath = `${jobId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from('artworks').upload(filePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (uploadError) {
    throw new ApiError(500, uploadError.message);
  }

  const { data: publicData } = supabase.storage.from('artworks').getPublicUrl(filePath);

  const payload = {
    job_id: jobId,
    file_name: file.originalname,
    file_path: filePath,
    file_url: publicData.publicUrl,
    file_type: file.mimetype,
    size_bytes: file.size,
    version,
    is_approved: false,
    network_path: resolveNetworkPath(extras.network_path, file.originalname),
    uploaded_by: userId,
  };
  const first = await supabase.from('job_artworks').insert(payload).select('*').single();
  if (first.error && /network_path/i.test(first.error.message || '')) {
    delete payload.network_path;
  }
  const artwork = first.error && /network_path/i.test(first.error.message || '')
    ? unwrap(await supabase.from('job_artworks').insert(payload).select('*').single(), 'Failed to save artwork')
    : unwrap(first, 'Failed to save artwork');

  emitJobUpdated({ id: jobId, artwork });
  return artwork;
}

export async function approveArtwork(id) {
  const artwork = unwrap(
    await supabase.from('job_artworks').select('*').eq('id', id).maybeSingle(),
    'Failed to load artwork'
  );
  if (!artwork) {
    throw new ApiError(404, 'Artwork not found');
  }

  const updated = unwrap(
    await supabase.from('job_artworks').update({ is_approved: true }).eq('id', id).select('*').single(),
    'Failed to approve artwork'
  );
  emitJobUpdated({ id: updated.job_id, artwork: updated });
  return updated;
}

export async function deleteArtwork(id, actor) {
  const artwork = unwrap(
    await supabase.from('job_artworks').select('*').eq('id', id).maybeSingle(),
    'Failed to load artwork'
  );
  if (!artwork) {
    throw new ApiError(404, 'Artwork not found');
  }
  if (actor?.role !== 'admin' && artwork.uploaded_by !== actor?.id) {
    throw new ApiError(403, 'You can only delete artwork you uploaded');
  }

  await supabase.storage.from('artworks').remove([artwork.file_path]);
  unwrap(await supabase.from('job_artworks').delete().eq('id', id), 'Failed to delete artwork');
  emitJobUpdated({ id: artwork.job_id, deleted_artwork_id: id });
  return { id };
}
