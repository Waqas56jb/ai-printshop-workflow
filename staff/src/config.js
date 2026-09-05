export const API_URL = (import.meta.env.VITE_API_URL || 'https://ai-printshop-workflow-server.vercel.app').replace(
  /\/$/,
  ''
);
export const WORKER_URL = (
  import.meta.env.VITE_WORKER_URL || 'https://ai-printshop-workflow-worker.vercel.app'
).replace(/\/$/, '');
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const REALTIME_ENABLED = import.meta.env.VITE_REALTIME_ENABLED !== 'false';
