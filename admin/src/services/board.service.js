import api from './api.js';

export async function getBoardScreens() {
  const { data } = await api.get('/api/board/screens');
  return data.data;
}

export async function getBoardStats() {
  const { data } = await api.get('/api/board/stats');
  return data.data;
}
