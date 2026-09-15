import { getIO } from './index.js';
import { invalidateBoardDisplayCache } from '../modules/board/board.service.js';

function broadcast(event, payload) {
  const io = getIO();
  if (!io) return;
  io.to('board').to('staff').to('admin').emit(event, payload);
}

function broadcastBoard(event, payload) {
  const io = getIO();
  if (!io) return;
  io.to('board').emit(event, payload);
}

export function hasBoardSockets() {
  const io = getIO();
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get('board');
  return Boolean(room && room.size > 0);
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
