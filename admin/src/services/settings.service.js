import api from './api.js';

export async function getSettings() {
  const { data } = await api.get('/api/settings');
  return data.data;
}

export async function updateSettings(payload) {
  const { data } = await api.patch('/api/settings', payload);
  return data.data;
}

export async function uploadLogo(file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/api/settings/logo', form);
  return data.data;
}

export async function regenerateBoardKey() {
  const { data } = await api.post('/api/settings/regenerate-board-key');
  return data.data;
}

export async function regenerateOmiSecret() {
  const { data } = await api.post('/api/settings/regenerate-omi-secret');
  return data.data;
}

export async function exportData() {
  const { data } = await api.get('/api/settings/export', { responseType: 'blob' });
  return data;
}

export async function cleanupJobs(older_than_days = 365) {
  const { data } = await api.delete('/api/jobs/cleanup', { params: { older_than_days } });
  return data.data;
}
