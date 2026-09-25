import { getIO } from './index.js';
import { invalidateBoardDisplayCache } from '../modules/board/board.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

function emitToRooms(rooms, event, payload) {
  const io = getIO();
  if (!io) return;
  rooms.forEach((room) => io.to(room).emit(event, payload));
}

function broadcast(event, payload) {
  emitToRooms(['board', 'staff', 'admin'], event, payload);
}

// Every voice-driven board event gets a sequence number and is kept briefly so a
// TV whose WebSocket is blocked or reconnecting can catch up over plain HTTP
// (GET /api/board/events?after=<seq>) instead of silently missing commands.
const EVENT_LOG_LIMIT = 80;
const REPLAY_WINDOW_MS = 30_000;
const eventLog = [];
let boardSeq = 0;

function recordBoardEvent(event, payload) {
  boardSeq += 1;
  const stamped = { ...(payload || {}), _seq: boardSeq };
  eventLog.push({ seq: boardSeq, event, payload: stamped, at: Date.now() });
  if (eventLog.length > EVENT_LOG_LIMIT) eventLog.shift();
  return stamped;
}

export function listBoardEventsAfter(after) {
  const cursor = Number(after);
  if (!Number.isFinite(cursor) || cursor < 0) {
    return { seq: boardSeq, events: [] };
  }
  if (cursor > boardSeq) {
    return { seq: boardSeq, reset: true, events: [] };
  }
  const since = Date.now() - REPLAY_WINDOW_MS;
  return {
    seq: boardSeq,
    events: eventLog
      .filter((row) => row.seq > cursor && row.at >= since)
      .map(({ seq, event, payload }) => ({ seq, event, payload })),
  };
}

function broadcastBoard(event, payload) {
  const stamped = recordBoardEvent(event, payload);
  emitToRooms(['board'], event, stamped);
  void relayBoardEvent(event, payload);
}

export function hasBoardSockets() {
  const io = getIO();
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get('board');
  return Boolean(room && room.size > 0);
}

function relayTarget() {
  if (!process.env.VERCEL) return '';
  if (hasBoardSockets()) return '';
  const target = String(env.BOARD_RELAY_URL || '').replace(/\/$/, '');
  const self = String(env.PUBLIC_SERVER_URL || '').replace(/\/$/, '');
  if (!target || target === self) return '';
  return target;
}

async function relayBoardEvent(event, payload) {
  const target = relayTarget();
  if (!target) return;
  try {
    const secret = process.env.OMI_WEBHOOK_SECRET || env.OMI_WEBHOOK_SECRET || '';
    const response = await fetch(`${target}/api/omi/board-relay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-omi-secret': secret,
      },
      body: JSON.stringify({ event, payload }),
    });
    if (!response.ok) {
      logger.error(`board relay failed: ${response.status}`);
    }
  } catch (error) {
    logger.error(`board relay errored: ${error.message}`);
  }
}

const BOARD_EVENTS = new Set([
  'board:focus',
  'board:details',
  'board:artwork',
  'board:navigate',
  'board:confirm',
  'board:speak',
  'board:ticker',
  'board:listening',
  'board:refresh',
]);

export function applyRelayedBoardEvent(event, payload) {
  if (!BOARD_EVENTS.has(event)) return false;
  const { _seq, ...clean } = payload || {};
  emitToRooms(['board'], event, recordBoardEvent(event, clean));
  logger.info(`board relay applied ${event}`);
  return true;
}

function refreshBoard() {
  invalidateBoardDisplayCache();
  const io = getIO();
  if (!io) return;
  io.to('board').emit('board:refresh');
}

export function emitJobCreated(job) {
  broadcast('job:created', job);
  refreshBoard();
}

export function emitJobUpdated(job) {
  broadcast('job:updated', job);
  refreshBoard();
}

export function emitJobMoved(payload) {
  broadcast('job:moved', payload);
  refreshBoard();
}

export function emitJobDeleted(payload) {
  broadcast('job:deleted', payload);
  refreshBoard();
}

export function emitVoiceCommand(payload) {
  broadcast('voice:command', payload);
  refreshBoard();
}

export function emitBoardRefresh() {
  refreshBoard();
}

export function emitBoardFocus(payload) {
  broadcastBoard('board:focus', payload);
}

export function emitBoardDetails(payload) {
  broadcastBoard('board:details', payload);
}

export function emitBoardArtwork(payload) {
  broadcastBoard('board:artwork', payload);
}

export function emitBoardNavigate(payload) {
  broadcastBoard('board:navigate', payload);
}

export function emitBoardConfirm(payload) {
  broadcastBoard('board:confirm', payload);
}

export function emitBoardSpeak(payload) {
  broadcastBoard('board:speak', payload);
}

export function emitBoardTicker(payload) {
  broadcastBoard('board:ticker', payload);
}

export function emitBoardListening(payload) {
  broadcastBoard('board:listening', payload);
}
