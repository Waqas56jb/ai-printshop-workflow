import { getIO } from './index.js';

function broadcast(event, payload) {
  const io = getIO();
  if (!io) return;
  io.to('board').to('staff').to('admin').emit(event, payload);
}

function refreshBoard() {
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
