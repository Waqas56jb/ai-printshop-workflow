import api from './api.js';

export async function getStaffDashboard() {
  const { data } = await api.get('/api/dashboard/staff');
  return data.data;
}

export async function listPendingVoice() {
  const { data } = await api.get('/api/voice/history', {
    params: { status: 'pending_confirmation', page: 1, limit: 20 },
  });
  return data.data;
}

export async function confirmVoice(id, payload = {}) {
  const { data } = await api.patch(`/api/voice/${id}/confirm`, payload);
  return data.data;
}

export async function rejectVoice(id) {
  const { data } = await api.patch(`/api/voice/${id}/reject`);
  return data.data;
}

export async function getOmiSetupStatus() {
  const { data } = await api.get('/api/omi/setup-status');
  return data.data;
}
