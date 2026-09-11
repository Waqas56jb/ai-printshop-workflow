import { WORKER_URL } from '../config.js';
import api from './api.js';

export function clientPackUrl(tokenOrPath) {
  if (!tokenOrPath) return '';
  const path = String(tokenOrPath).startsWith('/c/')
    ? tokenOrPath
    : `/c/${tokenOrPath}`;
  return `${WORKER_URL}${path}`;
}

export async function listArtifacts(customerId) {
  const { data } = await api.get(`/api/customers/${customerId}/artifacts`);
  return data.data;
}

export async function uploadArtifacts(customerId, files, { sku = '', network_folder = '', proof_status = 'revision', onProgress } = {}) {
  const form = new FormData();
  Array.from(files || []).forEach((file) => {
    form.append('files', file);
    form.append('paths', file.webkitRelativePath || file.name);
  });
  if (sku) form.append('sku', sku);
  if (network_folder) form.append('network_folder', network_folder);
  if (proof_status) form.append('proof_status', proof_status);
  const { data } = await api.post(`/api/customers/${customerId}/artifacts`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data.data;
}

export async function updateArtifact(id, payload) {
  const { data } = await api.patch(`/api/artifacts/${id}`, payload);
  return data.data;
}

export async function deleteArtifact(id) {
  const { data } = await api.delete(`/api/artifacts/${id}`);
  return data.data;
}

export async function getSharePack(token) {
  const { data } = await api.get(`/api/share/clients/${token}`);
  return data.data;
}

export async function getShareLink(customerId, rotate = false) {
  const { data } = await api.post(`/api/customers/${customerId}/share-link`, { rotate });
  return data.data;
}
