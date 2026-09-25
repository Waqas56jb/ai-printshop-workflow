import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendOk } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import * as omiService from './omi.service.js';
import { applyRelayedBoardEvent } from '../../sockets/events.js';

// On Vercel (serverless) there is no live socket server and no memory between
// calls, so OMI traffic that still points at the old Vercel URL is forwarded
// whole to the persistent server, which does all voice + board work.
async function forwardToPersistentServer(req, res, path, body, contentType) {
  if (!process.env.VERCEL || req.headers['x-omi-forwarded']) return false;
  const target = String(env.BOARD_RELAY_URL || '').replace(/\/$/, '');
  if (!target) return false;
  const selfHost = req.get('x-forwarded-host') || req.get('host');
  if (new URL(target).host === selfHost) return false;

  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  try {
    const upstream = await fetch(`${target}${path}${query}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType, 'x-omi-forwarded': '1' },
      body,
    });
    res.status(upstream.status);
    res.type(upstream.headers.get('content-type') || 'application/json');
    res.send(await upstream.text());
    return true;
  } catch (error) {
    logger.error(`omi forward to ${target} failed: ${error.message}`);
    return false;
  }
}

export const audio = asyncHandler(async (req, res) => {
  const chunk = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (await forwardToPersistentServer(req, res, '/api/omi/audio', chunk, 'application/octet-stream')) return;
  await omiService.verifyOmiSecret(req);
  const uid = req.query.uid;
  if (!uid) {
    throw new ApiError(400, 'uid query parameter is required');
  }
  const sampleRate = Number(req.query.sample_rate) || 16000;
  if (chunk.length) omiService.handleAudioChunk(uid, chunk, sampleRate);
  return res.status(200).json({ ok: true });
});

export const webhook = asyncHandler(async (req, res) => {
  if (await forwardToPersistentServer(req, res, '/api/omi/webhook', JSON.stringify(req.body || {}), 'application/json')) {
    return;
  }
  await omiService.verifyOmiSecret(req);
  const uid = req.query.uid;
  if (!uid) {
    throw new ApiError(400, 'uid query parameter is required');
  }
  const sessionId = req.query.session_id || req.body?.session_id || '';
  const result = await omiService.handleWebhook({ uid, sessionId, payload: req.body });
  return res.status(200).json(
    omiService.buildWebhookResponse({
      sessionId,
      message: result.message,
    })
  );
});

export const setupStatus = asyncHandler(async (req, res) => {
  const status = await omiService.getSetupStatus(req);
  return sendOk(res, status, 'OMI setup status');
});

export const webhookUrl = asyncHandler(async (req, res) => {
  return sendOk(res, { url: await omiService.webhookUrl(req, { mask: false }) }, 'OMI webhook URL');
});

export const boardRelay = asyncHandler(async (req, res) => {
  await omiService.verifyOmiSecret(req);
  const event = req.body?.event;
  const payload = req.body?.payload;
  const ok = applyRelayedBoardEvent(event, payload);
  if (!ok) {
    throw new ApiError(400, 'Unknown board event');
  }
  return sendOk(res, { event }, 'Relayed');
});

export const debug = asyncHandler(async (_req, res) => {
  return sendOk(res, omiService.listDebugEvents(), 'OMI debug feed');
});
