import api from './api.js';
import { supabase } from './supabase.js';

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getMe() {
  const { data } = await api.get('/api/auth/me');
  return data.data;
}

export async function updateMe(payload) {
  const { data } = await api.patch('/api/auth/me', payload);
  return data.data;
}

export async function changePassword(payload) {
  const { data } = await api.post('/api/auth/change-password', payload);
  return data.data;
}

export async function signOutEverywhere() {
  const { data } = await api.post('/api/auth/sign-out-everywhere');
  return data.data;
}
