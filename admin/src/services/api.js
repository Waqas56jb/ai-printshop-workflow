import axios from 'axios';
import { toast } from 'sonner';
import { API_URL } from '../config.js';
import { supabase } from './supabase.js';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    if (error.response?.status === 403) {
      toast(error.response?.data?.message || 'You do not have permission to do that');
    }
    return Promise.reject(error);
  }
);

export default api;
