import api from './api.js';

export async function listStages() {
  const { data } = await api.get('/api/stages');
  return data.data;
}

export async function createStage(payload) {
  const { data } = await api.post('/api/stages', payload);
  return data.data;
}

export async function updateStage(id, payload) {
  const { data } = await api.patch(`/api/stages/${id}`, payload);
  return data.data;
}

export async function deleteStage(id) {
  const { data } = await api.delete(`/api/stages/${id}`);
  return data.data;
}

export async function reorderStages(ids) {
  const { data } = await api.patch('/api/stages/reorder', { ids });
  return data.data;
}

export async function getBoard() {
  const { data } = await api.get('/api/board');
  return data.data;
}

export async function listUsers() {
  const { data } = await api.get('/api/users');
  return data.data;
}

export async function listCustomers(params = {}) {
  const { data } = await api.get('/api/customers', { params });
  return data.data;
}

export async function createCustomer(payload) {
  const { data } = await api.post('/api/customers', payload);
  return data.data;
}

export async function getCustomer(id) {
  const { data } = await api.get(`/api/customers/${id}`);
  return data.data;
}

export async function getCustomerStats() {
  const { data } = await api.get('/api/customers/stats');
  return data.data;
}

export async function updateCustomer(id, payload) {
  const { data } = await api.patch(`/api/customers/${id}`, payload);
  return data.data;
}

export async function deleteCustomer(id) {
  const { data } = await api.delete(`/api/customers/${id}`);
  return data.data;
}

export async function listJobs(params = {}) {
  const { data } = await api.get('/api/jobs', { params });
  return data.data;
}

export async function getJob(id) {
  const { data } = await api.get(`/api/jobs/${id}`);
  return data.data;
}

export async function createJob(payload) {
  const { data } = await api.post('/api/jobs', payload);
  return data.data;
}

export async function updateJob(id, payload) {
  const { data } = await api.patch(`/api/jobs/${id}`, payload);
  return data.data;
}

export async function moveJobStage(id, stage_id) {
  const { data } = await api.patch(`/api/jobs/${id}/stage`, { stage_id, source: 'manual' });
  return data.data;
}

export async function assignJob(id, assigned_to) {
  const { data } = await api.patch(`/api/jobs/${id}/assign`, { assigned_to });
  return data.data;
}

export async function listArtworks(jobId) {
  const { data } = await api.get(`/api/jobs/${jobId}/artworks`);
  return data.data;
}

export async function completeJob(id) {
  const { data } = await api.patch(`/api/jobs/${id}/complete`);
  return data.data;
}

export async function cancelJob(id) {
  const { data } = await api.patch(`/api/jobs/${id}`, { status: 'cancelled' });
  return data.data;
}

export async function deleteJob(id) {
  const { data } = await api.delete(`/api/jobs/${id}`);
  return data.data;
}

export async function approveArtwork(id) {
  const { data } = await api.patch(`/api/artworks/${id}/approve`);
  return data.data;
}

export async function deleteArtwork(id) {
  const { data } = await api.delete(`/api/artworks/${id}`);
  return data.data;
}

export async function createNote(jobId, content) {
  const { data } = await api.post(`/api/jobs/${jobId}/notes`, { content });
  return data.data;
}

export async function deleteNote(id) {
  const { data } = await api.delete(`/api/notes/${id}`);
  return data.data;
}

export async function uploadArtwork(jobId, file, onProgress) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/api/jobs/${jobId}/artworks`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data.data;
}

export function duePresetToRange(due) {
  const today = new Date().toISOString().slice(0, 10);
  if (due === 'overdue') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return { due_to: yesterday.toISOString().slice(0, 10) };
  }
  if (due === 'today') {
    return { due_from: today, due_to: today };
  }
  if (due === 'this_week') {
    const start = new Date();
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { due_from: start.toISOString().slice(0, 10), due_to: end.toISOString().slice(0, 10) };
  }
  if (due === 'next_week') {
    const start = new Date();
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1) + 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { due_from: start.toISOString().slice(0, 10), due_to: end.toISOString().slice(0, 10) };
  }
  return {};
}
