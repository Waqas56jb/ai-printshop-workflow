export const API_URL = (import.meta.env.VITE_API_URL || 'https://ai-printshop-workflow-server.vercel.app').replace(
  /\/$/,
  ''
);
export const PUBLIC_API_URL = 'https://ai-printshop-workflow-server.vercel.app';

export function toPublicApiUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return `${PUBLIC_API_URL}${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    return url;
  }
}
export const WORKER_URL = (
  import.meta.env.VITE_WORKER_URL || 'https://ai-printshop-workflow-worker.vercel.app'
).replace(/\/$/, '');
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
