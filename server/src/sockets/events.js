import { getIO } from './index.js';

function broadcast(event, payload) {
  const io = getIO();
  io.to('board').to('staff').to('admin').emit(event, payload);
}

export function emitJobCreated(job) {
  broadcast('job:created', job);
  getIO().to('board').emit('board:refresh');
}

export function emitJobUpdated(job) {
  broadcast('job:updated', job);
  getIO().to('board').emit('board:refresh');
}

export function emitJobMoved(payload) {
  broadcast('job:moved', payload);
  getIO().to('board').emit('board:refresh');
}

export function emitJobDeleted(payload) {
  broadcast('job:deleted', payload);
  getIO().to('board').emit('board:refresh');
}

export function emitVoiceCommand(payload) {
  broadcast('voice:command', payload);
  getIO().to('board').emit('board:refresh');
}

export function emitBoardRefresh() {
  try {
    getIO().to('board').emit('board:refresh');
  } catch {
    /* sockets not initialized (CLI scripts) */
  }
}
