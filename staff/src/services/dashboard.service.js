import api from './api.js';
import { getStaffDashboard } from './today.service.js';

export { getStaffDashboard };

export async function getOmiSetupStatus() {
  const { data } = await api.get('/api/omi/setup-status');
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

export async function rejectVoice(id) {
  const { data } = await api.patch(`/api/voice/${id}/reject`);
  return data.data;
}

export async function sendVoiceCommand(transcript) {
  const { data } = await api.post('/api/voice/command', { transcript });
  return data;
}
