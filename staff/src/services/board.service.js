import api from './api.js';

export async function getBoardKey() {
  const { data } = await api.get('/api/board/key');
  return data.data;
}

export async function getBoardStats() {
  const { data } = await api.get('/api/board/stats');
  return data.data;
}
