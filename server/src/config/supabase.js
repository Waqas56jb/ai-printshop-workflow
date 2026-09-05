import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
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
