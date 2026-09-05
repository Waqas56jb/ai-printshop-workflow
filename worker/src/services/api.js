import axios from 'axios';
import { API_URL } from '../config.js';

const api = axios.create({
  baseURL: API_URL,
});

export async function getBoard(key = '') {
  const preview = new URLSearchParams(window.location.search).get('preview');
  const params = {
    ...(key ? { key } : {}),
    ...(preview === '1' ? { preview: '1' } : {}),
  };
  const { data } = await api.get('/api/board', { params });
  return data.data;
}

export default api;
