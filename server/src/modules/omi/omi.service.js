import { supabase, unwrap } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import * as voiceService from '../voice/voice.service.js';
import * as settingsService from '../settings/settings.service.js';

const debugEvents = [];
const DEBUG_LIMIT = 20;

function recordDebug(entry) {
  debugEvents.unshift({ at: new Date().toISOString(), ...entry });
  if (debugEvents.length > DEBUG_LIMIT) debugEvents.length = DEBUG_LIMIT;
}

export function listDebugEvents() {
  return debugEvents;
}

const memoryBuffers = new Map();
const memoryStamps = new Map();
const inflight = new Map();
const FLUSH_MS = 1200;
const MIN_WORDS = 3;
const YES = /^(yes|yeah|yep|yup|ok|okay|confirm|sure|do it|go ahead)[.!?]?$/i;
const NO = /^(no|nope|nah|cancel|stop|don't|dont|reject)[.!?]?$/i;

function speakable(text) {
  const message = String(text || '').replace(/\s+/g, ' ').trim();
  if (!message) return '';
  return message.length > 5 ? message : `${message} okay.`;
}

function extractUserTexts(payload) {
  const segments = Array.isArray(payload)
    ? payload
    : payload?.segments || payload?.transcript_segments;
  if (Array.isArray(segments) && segments.length) {
    const rows = segments.filter((segment) => typeof segment === 'string' || segment?.text);
    const userRows = rows.filter((segment) => typeof segment === 'string' || segment?.is_user !== false);
    return (userRows.length ? userRows : rows)
      .map((segment) => (typeof segment === 'string' ? segment : segment?.text))
      .filter((text) => typeof text === 'string' && text.trim())
      .map((text) => text.trim());
  }
  if (typeof payload?.transcript === 'string') return [payload.transcript.trim()];
  if (typeof payload?.text === 'string') return [payload.text.trim()];
  return [];
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function isCompleteSentence(text) {
  return /[.?!]["']?$/.test(text);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function appendBuffer(key, texts) {
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase.from('omi_buffers').select('texts').eq('buffer_key', key).maybeSingle();
  if (!error) {
    const next = [...(data?.texts || []), ...texts];
    unwrap(
      await supabase.from('omi_buffers').upsert({
        buffer_key: key,
        texts: next,
        updated_at: updatedAt,
      }),
      'Failed to buffer transcript'
    );
    return { texts: next, updatedAt };
  }
  const current = memoryBuffers.get(key) || [];
  const next = [...current, ...texts];
  memoryBuffers.set(key, next);
  memoryStamps.set(key, updatedAt);
  return { texts: next, updatedAt };
}

async function peekBuffer(key) {
  const { data, error } = await supabase
    .from('omi_buffers')
    .select('texts, updated_at')
    .eq('buffer_key', key)
    .maybeSingle();
  if (!error) {
    return { texts: data?.texts || [], updatedAt: data?.updated_at || null };
  }
  return { texts: memoryBuffers.get(key) || [], updatedAt: memoryStamps.get(key) || null };
}

async function takeBuffer(key) {
  const { data, error } = await supabase.from('omi_buffers').delete().eq('buffer_key', key).select('texts').maybeSingle();
  if (!error) return data?.texts || [];
  const texts = memoryBuffers.get(key) || [];
  memoryBuffers.delete(key);
  memoryStamps.delete(key);
  return texts;
}

async function sendOmiNotification(uid, message) {
  if (!env.OMI_APP_ID || !env.OMI_APP_SECRET || !uid || !message) return false;
  try {
    const response = await fetch('https://api.omi.me/v1/integrations/notification', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OMI_APP_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        aid: env.OMI_APP_ID,
        message,
      }),
    });
    recordDebug({ uid, kind: 'notify', text: message, ok: response.ok, status: response.status });
    return response.ok;
  } catch (error) {
    recordDebug({ uid, kind: 'notify', text: message, ok: false, error: error.message });
    return false;
  }
}

export function buildWebhookResponse({ sessionId, message }) {
  return { message: speakable(message), session_id: sessionId || '' };
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
  const configured = env.PUBLIC_SERVER_URL?.replace(/\/$/, '');
  if (configured) return configured;
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

export async function handleWebhook({ uid, sessionId = '', payload }) {
  const texts = extractUserTexts(payload);
  const key = `${uid}::${sessionId || 'default'}`;
  const heard = texts.join(' ').replace(/\s+/g, ' ').trim() || '(empty)';
  recordDebug({ uid, session: sessionId, kind: 'webhook', text: heard });
  logger.info(`omi webhook uid=${uid} text=${heard}`);
  if (!texts.length) {
    return { message: '', replyOnDevice: false };
  }

  const appended = await appendBuffer(key, texts);
  const combined = appended.texts.join(' ').replace(/\s+/g, ' ').trim();
  const waitMs = isCompleteSentence(combined) && wordCount(combined) >= MIN_WORDS ? 400 : FLUSH_MS;
  const pending = flushBuffer({ key, uid, sessionId, waitMs, startedAt: Date.now() });
  inflight.set(key, pending);
  return pending;
}

async function latestPendingCommand(omiUid) {
  if (!omiUid) return null;
  const { data, error } = await supabase
    .from('voice_commands')
    .select('id, user_id')
    .eq('omi_uid', omiUid)
    .eq('status', 'pending_confirmation')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

async function flushBuffer({ key, uid, sessionId, waitMs, startedAt }) {
  await sleep(waitMs);
  const latest = await peekBuffer(key);
  if (latest.updatedAt && new Date(latest.updatedAt).getTime() > startedAt + 80) {
    return { message: '', replyOnDevice: false };
  }

  const flushed = (await takeBuffer(key)).join(' ').replace(/\s+/g, ' ').trim();
  if (!flushed) {
    return { message: '', replyOnDevice: false };
  }

  try {
    const profile = await voiceService.findProfileByOmiUid(uid);
    await touchDevice(uid, profile?.id || null);
    const pending = await latestPendingCommand(uid);

    if (pending && YES.test(flushed)) {
      const result = await voiceService.confirmCommand(pending.id, profile?.id || pending.user_id);
      return finishReply(uid, sessionId, flushed, result.message || 'Okay, done.');
    }
    if (pending && NO.test(flushed)) {
      await voiceService.rejectCommand(pending.id);
      return finishReply(uid, sessionId, flushed, 'Okay, cancelled.');
    }

    if (wordCount(flushed) < MIN_WORDS) {
      recordDebug({ uid, session: sessionId, kind: 'ignore', text: flushed, reason: 'too_short' });
      return { message: '', replyOnDevice: false };
    }

    const result = await voiceService.runIntentPipeline({
      transcript: flushed,
      userId: profile?.id || null,
      omiUid: uid,
    });
    const message = speakable(result.message);
    if (!message) {
      recordDebug({ uid, session: sessionId, kind: 'ignore', text: flushed, reason: 'no_reply' });
      return { message: '', replyOnDevice: false };
    }
    return finishReply(uid, sessionId, flushed, message);
  } catch (error) {
    logger.error(`omi flush failed: ${error.message}`);
    recordDebug({ uid, session: sessionId, kind: 'error', text: error.message });
    return { message: speakable(error.message || 'Something went wrong.'), replyOnDevice: true };
  }
}

async function finishReply(uid, sessionId, transcript, rawMessage) {
  const message = speakable(rawMessage);
  const settings = await settingsService.getSettings();
  const replyOnDevice = settings.voice_reply_on_device !== false;
  recordDebug({ uid, session: sessionId, kind: 'reply', text: message, transcript });
  logger.info(`omi reply uid=${uid} message=${message}`);
  if (replyOnDevice) await sendOmiNotification(uid, message);
  return { message, replyOnDevice };
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
