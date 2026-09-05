import crypto from 'node:crypto';
import path from 'node:path';
import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';
import { toCsv, zipStore } from '../../utils/zip.js';
import { emitBoardRefresh } from '../../sockets/events.js';

export const SETTING_DEFAULTS = {
  business_name: 'Print Shop',
  business_logo_url: '',
  phone: '',
  address: '',
  currency: 'PKR',
  working_hours: {
    mon_fri: { open: '09:00', close: '19:00' },
    saturday: { open: '10:00', close: '17:00' },
    sunday: null,
  },
  board_theme: 'dark',
  board_card_size: 'normal',
  board_show_customer: true,
  board_show_due: true,
  board_overdue_highlight: true,
  board_hide_delivered_after: 2,
  board_refresh_seconds: 30,
  board_public: true,
  job_number_prefix: 'J-',
  default_due_days: 3,
  default_priority: 'normal',
  product_types: ['T-Shirt', 'Hoodie', 'Flyer', 'Business card', 'Banner', 'Sticker'],
  print_types: ['Screen print', 'DTF', 'DTG', 'Sublimation', 'Digital', 'Offset'],
  require_artwork_before_printing: true,
  notify_overdue_email: true,
  notify_pending_voice: true,
  notify_daily_summary: false,
  notify_email: '',
};

const HIDDEN_KEYS = new Set(['omi_webhook_secret']);
const LOCKED_KEYS = new Set(['board_key', 'omi_webhook_secret']);

function sanitizeFileName(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function getRawSettings() {
  const rows = unwrap(
    await supabase.from('settings').select('*').order('key', { ascending: true }),
    'Failed to load settings'
  );
  return (rows || []).reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

export async function getSettings() {
  const stored = await getRawSettings();
  const merged = { ...SETTING_DEFAULTS, ...stored };
  for (const key of HIDDEN_KEYS) {
    delete merged[key];
  }
  try {
    const next = unwrap(await supabase.rpc('peek_next_job_number'), 'Failed to peek job number');
    merged.job_number_next = Number(next);
  } catch {
    merged.job_number_next = null;
  }
  return merged;
}

export async function getSetting(key, fallback = null) {
  const settings = await getRawSettings();
  return settings[key] ?? SETTING_DEFAULTS[key] ?? fallback;
}

export function isBoardPublic(value) {
  if (value === undefined || value === null) return true;
  return value !== false && value !== 'false' && value !== 0;
}

export async function updateSettings(patch) {
  const entries = Object.entries(patch).filter(
    ([key, value]) => value !== undefined && !LOCKED_KEYS.has(key)
  );
  if (!entries.length) {
    return getSettings();
  }

  const rows = entries.map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }));

  unwrap(await supabase.from('settings').upsert(rows, { onConflict: 'key' }), 'Failed to update settings');
  emitBoardRefresh();
  return getSettings();
}

export async function writeSetting(key, value) {
  unwrap(
    await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
    'Failed to update setting'
  );
  emitBoardRefresh();
  return getSettings();
}

export async function getOmiSecret() {
  const fromSettings = await getSetting('omi_webhook_secret', null);
  return fromSettings || process.env.OMI_WEBHOOK_SECRET || '';
}

export async function uploadLogo(file) {
  if (!file) {
    throw new ApiError(400, 'File is required');
  }

  await supabase.storage.createBucket('branding', { public: true }).catch(() => {});

  const safeName = sanitizeFileName(file.originalname || 'logo.png');
  const filePath = `logo/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from('branding').upload(filePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });
  if (error) {
    throw new ApiError(500, error.message);
  }

  const { data } = supabase.storage.from('branding').getPublicUrl(filePath);
  await writeSetting('business_logo_url', data.publicUrl);
  return { url: data.publicUrl };
}

export async function regenerateBoardKey() {
  const key = crypto.randomBytes(12).toString('hex');
  await writeSetting('board_key', key);
  return { board_key: key };
}

export async function regenerateOmiSecret() {
  const secret = `omi_${crypto.randomBytes(16).toString('hex')}`;
  await writeSetting('omi_webhook_secret', secret);
  return { secret };
}

export async function exportData() {
  const [jobs, customers, notes] = await Promise.all([
    unwrap(await supabase.from('jobs').select('*').order('created_at', { ascending: true }), 'Failed to export jobs'),
    unwrap(
      await supabase.from('customers').select('*').order('created_at', { ascending: true }),
      'Failed to export customers'
    ),
    unwrap(
      await supabase.from('job_notes').select('*').order('created_at', { ascending: true }),
      'Failed to export notes'
    ),
  ]);

  const jobColumns = [
    'id',
    'job_number',
    'title',
    'product_type',
    'quantity',
    'print_type',
    'price',
    'priority',
    'status',
    'due_date',
    'customer_id',
    'assigned_to',
    'created_at',
    'completed_at',
    'notes',
  ];
  const customerColumns = ['id', 'name', 'company', 'email', 'phone', 'notes', 'created_at'];
  const noteColumns = ['id', 'job_id', 'content', 'author_id', 'source', 'created_at'];

  return zipStore([
    { name: 'jobs.csv', data: toCsv(jobs, jobColumns) },
    { name: 'customers.csv', data: toCsv(customers, customerColumns) },
    { name: 'notes.csv', data: toCsv(notes, noteColumns) },
  ]);
}
