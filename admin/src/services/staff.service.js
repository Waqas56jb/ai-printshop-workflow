import api from './api.js';

export async function listUsers() {
  const { data } = await api.get('/api/users');
  return data.data;
}

export async function getUserStats() {
  const { data } = await api.get('/api/users/stats');
  return data.data;
}

export async function registerStaff(payload) {
  const { data } = await api.post('/api/auth/register-staff', payload);
  return data.data;
}

export async function updateUser(id, payload) {
  const { data } = await api.patch(`/api/users/${id}`, payload);
  return data.data;
}

export async function resetPassword(id, password) {
  const { data } = await api.post(`/api/users/${id}/reset-password`, password ? { password } : {});
  return data.data;
}

export async function deleteUser(id) {
  const { data } = await api.delete(`/api/users/${id}`);
  return data.data;
}
