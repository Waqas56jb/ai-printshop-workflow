import api from './api.js';

export async function getRealtimeConfig() {
  const { data } = await api.get('/api/realtime/config');
  return data.data;
}

export async function createRealtimeSession() {
  const { data } = await api.post('/api/realtime/session');
  return data.data;
}

export async function runRealtimeTool(name, args = {}) {
  const { data } = await api.post('/api/realtime/tool', { name, arguments: args });
  return data.data;
}
