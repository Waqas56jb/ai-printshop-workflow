import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

// Serverless (Vercel Node 20) has no native WebSocket. This API only uses REST/auth.
class ClosedWebSocket {
  constructor() {
    this.readyState = 3;
    this.binaryType = 'blob';
    this.protocol = '';
    this.url = '';
  }
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: typeof globalThis.WebSocket === 'function' ? globalThis.WebSocket : ClosedWebSocket,
  },
});

export function unwrap(result, message = 'Database error') {
  if (result.error) {
    logger.error(result.error);
    const status = result.error.code === 'PGRST116' ? 404 : 500;
    throw new ApiError(status, result.error.message || message);
  }
  return result.data;
}
