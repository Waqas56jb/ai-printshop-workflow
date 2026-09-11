import axios from 'axios';
import { toast } from 'sonner';
import { API_URL } from '../config.js';
import { supabase } from './supabase.js';

const api = axios.create({
  baseURL: API_URL,
});

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 15_000) return cachedToken;
  const { data } = await supabase.auth.getSession();
  cachedToken = data.session?.access_token || null;
  tokenExpiresAt = data.session?.expires_at ? data.session.expires_at * 1000 : 0;
  return cachedToken;
}

supabase.auth.onAuthStateChange((_event, session) => {
  cachedToken = session?.access_token || null;
  tokenExpiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      cachedToken = null;
      tokenExpiresAt = 0;
      window.location.assign('/login');
    }
    if (error.response?.status === 403) {
      toast(error.response?.data?.message || 'You do not have permission to do that');
    }
    return Promise.reject(error);
  }
);

export default api;
