import axios from 'axios';
import { API_URL } from '../config.js';

const api = axios.create({
  baseURL: API_URL,
});

export async function getBoard(key) {
  if (!key) return null;
  const preview = new URLSearchParams(window.location.search).get('preview');
  const { data } = await api.get('/api/board', {
    params: { key, ...(preview === '1' ? { preview: '1' } : {}) },
  });
  return data.data;
}

export default api;
