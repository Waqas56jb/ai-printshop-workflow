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

function broadcastBoard(event, payload) {
  emitToRooms(['board'], event, payload);
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
  'board:refresh',
]);

export function applyRelayedBoardEvent(event, payload) {
  if (!BOARD_EVENTS.has(event)) return false;
  emitToRooms(['board'], event, payload);
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
