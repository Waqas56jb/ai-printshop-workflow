import api from './api.js';

// Panel accounts: admins and sub-admins (role "staff"). Only admins may manage them.
export async function listAccounts() {
  const { data } = await api.get('/api/users', { params: { lite: 1 } });
  return (data.data || []).filter((user) => user.role === 'admin' || user.role === 'staff');
}

export async function createAccount({ full_name, email, password, role }) {
  const { data } = await api.post('/api/auth/register-staff', { full_name, email, password, role });
  return data.data;
}

export async function updateAccount(id, payload) {
  const { data } = await api.patch(`/api/users/${id}`, payload);
  return data.data;
}

export async function setPassword(id, password) {
  const { data } = await api.post(`/api/users/${id}/reset-password`, { password });
  return data.data;
}

export async function deleteAccount(id) {
  const { data } = await api.delete(`/api/users/${id}`);
  return data.data;
}

// A password that is easy to read out loud: Word-Word-1234.
const WORDS = ['Blue', 'Paper', 'Print', 'Shirt', 'Cotton', 'Silver', 'Banner', 'Copper', 'Green', 'Stamp', 'Maple', 'River'];
export function makePassword() {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${pick()}-${pick()}-${digits}`;
}
