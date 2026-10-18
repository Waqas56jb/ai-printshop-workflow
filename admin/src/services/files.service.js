import api from './api.js';

// Paths: '' (all customers), 'c:<id>' customer, 'j:<id>' job, 'f:<id>' folder.
export async function listFiles(path = '') {
  const { data } = await api.get('/api/files', { params: path ? { path } : undefined });
  return data.data;
}

export async function createFolder(path, name) {
  const { data } = await api.post('/api/files/folder', { path, name });
  return data.data;
}

// One file per request so each gets its own progress bar.
export async function uploadFile(path, file, onProgress) {
  const form = new FormData();
  form.append('files', file);
  const { data } = await api.post('/api/files/upload', form, {
    params: { path },
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data.data;
}

export async function renameItem(id, name) {
  const { data } = await api.patch(`/api/files/${encodeURIComponent(id)}`, { name });
  return data.data;
}

export async function deleteItem(id) {
  const { data } = await api.delete(`/api/files/${encodeURIComponent(id)}`);
  return data.data;
}

export async function downloadLink(id) {
  const { data } = await api.get(`/api/files/${encodeURIComponent(id)}/download`);
  return data.data;
}
