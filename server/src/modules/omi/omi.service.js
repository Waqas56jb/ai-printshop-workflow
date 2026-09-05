import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';
import * as voiceService from '../voice/voice.service.js';
import * as settingsService from '../settings/settings.service.js';

const buffers = new Map();
const debugEvents = [];
const DEBUG_LIMIT = 20;

function recordDebug(entry) {
  debugEvents.unshift({ at: new Date().toISOString(), ...entry });
  if (debugEvents.length > DEBUG_LIMIT) debugEvents.length = DEBUG_LIMIT;
}

export function listDebugEvents() {
  return debugEvents;
}

function extractTexts(payload) {
  if (Array.isArray(payload?.segments)) {
    return payload.segments
      .map((segment) => segment.text)
      .filter((text) => typeof text === 'string' && text.trim())
      .map((text) => text.trim());
  }
  if (typeof payload?.transcript === 'string') return [payload.transcript.trim()];
  if (typeof payload?.text === 'string') return [payload.text.trim()];
  return [];
}

export async function verifyOmiSecret(req) {
  const secret = await settingsService.getOmiSecret();
  if (!secret) {
    throw new ApiError(503, 'OMI webhook secret is not configured');
  }

  const headerSecret =
    req.headers['x-omi-secret'] ||
    req.headers['x-webhook-secret'] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);
  const provided = headerSecret || req.query.secret;

  if (provided !== secret) {
    throw new ApiError(401, 'Invalid OMI webhook secret');
  }
}

export function publicBase(req) {
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${proto}://${host}`;
}

export async function webhookUrl(req, { mask = false } = {}) {
  const secret = (await settingsService.getOmiSecret()) || '';
  const shown = mask && secret ? `${secret.slice(0, 4)}${'•'.repeat(Math.max(8, secret.length - 4))}` : secret;
  const query = shown ? `?secret=${shown}` : '';
  return `${publicBase(req)}/api/omi/webhook${query}`;
}

export async function touchDevice(omiUid, userId = null) {
  if (!omiUid) return;
  const existing = unwrap(
    await supabase.from('omi_devices').select('*').eq('omi_uid', omiUid).maybeSingle(),
    'Failed to load OMI device'
  );
  const now = new Date().toISOString();
  if (existing) {
    unwrap(
      await supabase
        .from('omi_devices')
        .update({ last_heard_at: now, user_id: existing.user_id || userId || null })
        .eq('omi_uid', omiUid),
      'Failed to update OMI device'
    );
    return;
  }
  unwrap(
    await supabase.from('omi_devices').insert({
      omi_uid: omiUid,
      user_id: userId || null,
      first_heard_at: now,
      last_heard_at: now,
    }),
    'Failed to record OMI device'
  );
}

export async function handleWebhook({ uid, payload }) {
  const texts = extractTexts(payload);
  recordDebug({
    uid,
    kind: 'webhook',
    text: texts.join(' ').replace(/\s+/g, ' ').trim() || '(empty)',
  });
  if (!texts.length) {
    return { message: 'No speech received.' };
  }

  if (!buffers.has(uid)) {
    let resolve;
    const promise = new Promise((next) => {
      resolve = next;
    });
    buffers.set(uid, { texts: [], promise, resolve, timer: null });
  }

  const buffer = buffers.get(uid);
  buffer.texts.push(...texts);

  clearTimeout(buffer.timer);
  buffer.timer = setTimeout(async () => {
    const sentence = buffer.texts.join(' ').replace(/\s+/g, ' ').trim();
    buffers.delete(uid);
    try {
      const profile = await voiceService.findProfileByOmiUid(uid);
      await touchDevice(uid, profile?.id || null);
      const result = await voiceService.runIntentPipeline({
        transcript: sentence,
        userId: profile?.id || null,
        omiUid: uid,
      });
      buffer.resolve({ message: result.message || 'Done.' });
    } catch (error) {
      buffer.resolve({ message: error.message || 'Something went wrong.' });
    }
  }, 3000);

  return buffer.promise;
}

export async function getSetupStatus(req) {
  const devices = unwrap(
    await supabase
      .from('omi_devices')
      .select('omi_uid, user_id, first_heard_at, last_heard_at, user:profiles!user_id(id, full_name, email)')
      .order('last_heard_at', { ascending: false }),
    'Failed to load OMI devices'
  ) || [];

  const lastCommand = unwrap(
    await supabase
      .from('voice_commands')
      .select('created_at, omi_uid, user:profiles!user_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'Failed to load last voice command'
  );

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const todayRows = unwrap(
    await supabase.from('voice_commands').select('id, status').gte('created_at', start.toISOString()),
    'Failed to load today voice commands'
  ) || [];

  const decided = todayRows.filter((row) => row.status === 'executed' || row.status === 'failed');
  const understood = decided.length
    ? Math.round((todayRows.filter((row) => row.status === 'executed').length / decided.length) * 100)
    : todayRows.length
      ? 100
      : 0;

  const lastAt = lastCommand?.created_at || devices[0]?.last_heard_at || null;
  const receiving = lastAt ? Date.now() - new Date(lastAt).getTime() < 10 * 60 * 1000 : false;
  const lastDevice =
    lastCommand?.user?.full_name ||
    devices.find((item) => item.omi_uid === lastCommand?.omi_uid)?.user?.full_name ||
    (lastCommand?.omi_uid ? 'Unassigned device' : null);

  return {
    receiving,
    last_command_at: lastCommand?.created_at || null,
    last_device_name: lastDevice,
    devices: devices.map((item) => ({
      omi_uid: item.omi_uid,
      user: item.user || null,
      first_heard_at: item.first_heard_at,
      last_heard_at: item.last_heard_at,
    })),
    today_count: todayRows.length,
    understood_percent: understood,
    webhook_url: await webhookUrl(req, { mask: true }),
    configured: Boolean(await settingsService.getOmiSecret()),
    profiles_with_omi: devices.filter((item) => item.user_id).length,
    webhook_path: '/api/omi/webhook',
  };
}
