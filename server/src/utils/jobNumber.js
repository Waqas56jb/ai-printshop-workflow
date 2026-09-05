import { supabase, unwrap } from '../config/supabase.js';
import { ApiError } from './ApiError.js';
import * as settingsService from '../modules/settings/settings.service.js';

export async function generateJobNumber() {
  const data = unwrap(await supabase.rpc('generate_job_number'), 'Failed to generate job number');
  if (!data) {
    throw new ApiError(500, 'Failed to generate job number');
  }
  const prefix = await settingsService.getSetting('job_number_prefix', 'J-');
  return `${prefix}${String(data).replace(/^J-/, '')}`;
}
