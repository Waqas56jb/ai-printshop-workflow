import { supabase, unwrap } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import * as voiceService from '../voice/voice.service.js';
import * as boardVoiceService from '../voice/boardVoice.service.js';
import * as settingsService from '../settings/settings.service.js';
import { closeWindow, gateUtterance, openWindow, wordCount } from './commandGate.js';
import { ingestAudio, transcribeEnglish } from './omi.audio.js';

const debugEvents = [];
const DEBUG_LIMIT = 20;

function recordDebug(entry) {
  debugEvents.unshift({ at: new Date().toISOString(), ...entry });
  if (debugEvents.length > DEBUG_LIMIT) debugEvents.length = DEBUG_LIMIT;
}

export function listDebugEvents() {
  return debugEvents;
}

// Transcript segments are buffered in memory per OMI session. This runs on the
// persistent server (Vercel forwards OMI traffic here), so a plain Map is both
// race-free and much faster than the old Supabase round trips per segment.
const buffers = new Map();
const audioSeen = new Map();
const SETTLE_MS = 350;
const QUIET_MS = 900;
const INCOMPLETE_EXTRA_MS = 1300;
const CONFIRM_WINDOW_MS = 15_000;
const PENDING_MAX_AGE_MS = 2 * 60 * 1000;
const SHORT_COMMANDS = /^(done|ready|next|back|zoom|yes|yeah|yep|no|nope|stop|cancel)[.!?]?$/i;
const YES = /^(yes|yeah|yep|yup|ok|okay|confirm|sure|do it|go ahead)[.!?]?$/i;
const NO = /^(no|nope|nah|cancel|stop|don't|dont|reject)[.!?]?$/i;

export function noteAudioActivity(uid) {
  audioSeen.set(uid, Date.now());
}

// When a device streams raw audio we transcribe it ourselves (English-locked),
// so its OMI transcript webhook would only produce duplicate commands.
function audioPathActive(uid) {
  const at = audioSeen.get(uid);
  return Boolean(at && Date.now() - at < 20_000);
}

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

function isCompleteSentence(text) {
  return /[.?!]["']?$/.test(text);
}

function mergeTranscriptParts(existing, incoming) {
  const prev = (existing || []).join(' ').replace(/\s+/g, ' ').trim();
  const next = (incoming || []).join(' ').replace(/\s+/g, ' ').trim();
  if (!next) return existing || [];
  if (!prev) return [next];
  const prevL = prev.toLowerCase();
  const nextL = next.toLowerCase();
  if (nextL === prevL) return [prev];
  if (nextL.startsWith(prevL) || nextL.includes(prevL)) return [next];
  if (prevL.startsWith(nextL) || prevL.includes(nextL)) return [prev];
  return [prev, next];
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

const EMPTY = { message: '', replyOnDevice: false };

function joined(parts) {
  return (parts || []).join(' ').replace(/\s+/g, ' ').trim();
}

function commandLooksComplete(command) {
  return isCompleteSentence(command) || wordCount(command) >= 4 || SHORT_COMMANDS.test(command);
}

export async function handleWebhook({ uid, sessionId = '', payload }) {
  const texts = extractUserTexts(payload);
  const heard = joined(texts) || '(empty)';
  recordDebug({ uid, session: sessionId, kind: 'webhook', text: heard });
  logger.info(`omi webhook uid=${uid} text=${heard}`);
  if (!texts.length) return EMPTY;
  if (audioPathActive(uid)) {
    recordDebug({ uid, session: sessionId, kind: 'ignore', text: heard, reason: 'audio_path_active' });
    return EMPTY;
  }

  const key = `${uid}::${sessionId || 'default'}`;
  const entry = buffers.get(key) || { texts: [], version: 0, timer: null, resolve: null, extended: false };
  // Keep only the tail of long overheard conversation so the buffer can't grow unbounded.
  entry.texts = mergeTranscriptParts(entry.texts, texts).slice(-4);
  entry.version += 1;
  buffers.set(key, entry);

  // The newest segment owns the reply; an earlier request still waiting returns empty.
  clearTimeout(entry.timer);
  entry.resolve?.(EMPTY);

  const wait = isCompleteSentence(joined(entry.texts)) ? SETTLE_MS : QUIET_MS;
  return new Promise((resolve) => {
    entry.resolve = resolve;
    scheduleSettle(key, uid, sessionId, wait);
  });
}

function scheduleSettle(key, uid, sessionId, wait) {
  const entry = buffers.get(key);
  if (!entry) return;
  const { version } = entry;
  entry.timer = setTimeout(() => {
    settleBuffer(key, uid, sessionId, version).catch((error) => {
      logger.error(`omi settle failed: ${error.message}`);
      const current = buffers.get(key);
      if (current?.version === version) {
        buffers.delete(key);
        current.resolve?.(EMPTY);
      }
    });
  }, wait);
}

async function settleBuffer(key, uid, sessionId, version) {
  const entry = buffers.get(key);
  if (!entry || entry.version !== version) return;
  const text = joined(entry.texts);
  const settings = await settingsService.getSettings();
  if (entry.version !== version) return;

  const gate = gateUtterance(uid, text, settings);
  // "Hey board, pull up…" often arrives split across segments — give the rest of
  // the sentence one short extra wait before acting on a half command.
  if (gate.kind === 'command' && !entry.extended && !commandLooksComplete(gate.command)) {
    entry.extended = true;
    recordDebug({ uid, session: sessionId, kind: 'hold', text, reason: 'incomplete_command' });
    scheduleSettle(key, uid, sessionId, INCOMPLETE_EXTRA_MS);
    return;
  }

  buffers.delete(key);
  const result = await processGated(uid, sessionId, text, gate);
  entry.resolve?.(result);
}

async function processGated(uid, sessionId, text, gate) {
  if (gate.kind === 'ignore') {
    recordDebug({ uid, session: sessionId, kind: 'ignore', text, reason: gate.reason });
    return EMPTY;
  }
  if (gate.kind === 'listening') {
    recordDebug({ uid, session: sessionId, kind: 'listening', text });
    boardVoiceService.listening(true);
    return EMPTY;
  }
  return runCommand(uid, sessionId, gate.command);
}

// Entry point for speech that is already a finished utterance (raw-audio path).
export async function handleSpokenText(uid, text, { sessionId = 'audio' } = {}) {
  const settings = await settingsService.getSettings();
  const gate = gateUtterance(uid, text, settings);
  return processGated(uid, sessionId, text, gate);
}

const audioChains = new Map();

// Utterances from one device are transcribed and handled strictly in order, so
// "Hey board" always opens the listening window before the command after it lands.
export function handleAudioChunk(uid, chunk, sampleRate) {
  noteAudioActivity(uid);
  ingestAudio(uid, chunk, sampleRate, (pcm, rate) => {
    const previous = audioChains.get(uid) || Promise.resolve();
    const next = previous
      .then(async () => {
        const text = await transcribeEnglish(pcm, rate);
        recordDebug({ uid, session: 'audio', kind: 'transcript', text: text || '(silence)' });
        logger.info(`omi audio uid=${uid} text=${text || '(silence)'}`);
        if (text) await handleSpokenText(uid, text);
      })
      .catch((error) => logger.error(`omi audio utterance failed: ${error.message}`));
    audioChains.set(uid, next);
  });
}

async function latestPendingCommand(omiUid) {
  if (!omiUid) return null;
  const { data, error } = await supabase
    .from('voice_commands')
    .select('id, user_id')
    .eq('omi_uid', omiUid)
    .eq('status', 'pending_confirmation')
    .gte('created_at', new Date(Date.now() - PENDING_MAX_AGE_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

async function runCommand(uid, sessionId, command) {
  closeWindow(uid);
  boardVoiceService.listening(true);
  logger.info(`omi command uid=${uid} text=${command}`);
  try {
    const profile = await voiceService.findProfileByOmiUid(uid);
    await touchDevice(uid, profile?.id || null);
    const pending = await latestPendingCommand(uid);

    if (pending && YES.test(command)) {
      const result = await voiceService.confirmCommand(pending.id, profile?.id || pending.user_id);
      return finishReply(uid, sessionId, command, result.message || 'Okay, done.');
    }
    if (pending && NO.test(command)) {
      await voiceService.rejectCommand(pending.id);
      return finishReply(uid, sessionId, command, 'Okay, cancelled.');
    }

    const result = await voiceService.runIntentPipeline({
      transcript: command,
      userId: profile?.id || null,
      omiUid: uid,
      userName: profile?.full_name || null,
      wakeHandled: true,
    });
    if (result.needs_confirmation) openWindow(uid, CONFIRM_WINDOW_MS);
    const message = speakable(result.message);
    if (!message) {
      recordDebug({ uid, session: sessionId, kind: 'ignore', text: command, reason: 'no_reply' });
      return EMPTY;
    }
    return finishReply(uid, sessionId, command, message);
  } catch (error) {
    logger.error(`omi command failed: ${error.message}`);
    recordDebug({ uid, session: sessionId, kind: 'error', text: error.message });
    return { message: speakable(error.message || 'Something went wrong.'), replyOnDevice: true };
  } finally {
    boardVoiceService.listening(false);
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
