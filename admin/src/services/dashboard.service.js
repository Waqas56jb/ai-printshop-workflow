import { toPublicApiUrl } from '../config.js';
import api from './api.js';

export async function getAdminDashboard() {
  const { data } = await api.get('/api/dashboard/admin');
  return data.data;
}

export async function getOmiSetupStatus() {
  const { data } = await api.get('/api/omi/setup-status');
  const status = data.data;
  if (status?.webhook_url) status.webhook_url = toPublicApiUrl(status.webhook_url);
  return status;
}

export async function listJobs(params = {}) {
  const { data } = await api.get('/api/jobs', { params });
  return data.data;
}

export async function listVoiceHistory(params = {}) {
  const { data } = await api.get('/api/voice/history', { params });
  return data.data;
}

export async function confirmVoice(id, job_id) {
  const { data } = await api.patch(`/api/voice/${id}/confirm`, job_id ? { job_id } : {});
  return data.data;
}

export async function getSettings() {
  const { data } = await api.get('/api/settings');
  return data.data;
}

export async function updateSettings(payload) {
  const { data } = await api.patch('/api/settings', payload);
  return data.data;
}

export async function getOmiWebhookUrl() {
  const { data } = await api.get('/api/omi/webhook-url');
  return { ...data.data, url: toPublicApiUrl(data.data?.url) };
}

export async function getOmiDebug() {
  const { data } = await api.get('/api/omi/debug');
  return data.data;
}

export async function sendVoiceCommand(transcript) {
  const { data } = await api.post('/api/voice/command', { transcript });
  return data;
}

export async function updateUser(id, payload) {
  const { data } = await api.patch(`/api/users/${id}`, payload);
  return data.data;
}

export async function rejectVoice(id) {
  const { data } = await api.patch(`/api/voice/${id}/reject`);
  return data.data;
}
