// Tracks per-board "what's on the TV" state (focused job, artwork index, filter).
// Broadcasts go to the whole 'board' room at once, so every connected TV sees the
// same thing — a single shared session (keyed for future multi-board support) is
// enough rather than tracking state per physical socket.
const DEFAULT_KEY = 'board';
const sessions = new Map();

function emptySession() {
  return { focused_job_id: null, artwork_index: 0, board_filter: 'all' };
}

export function getBoardSession(key = DEFAULT_KEY) {
  if (!sessions.has(key)) {
    sessions.set(key, emptySession());
  }
  return sessions.get(key);
}

export function updateBoardSession(patch, key = DEFAULT_KEY) {
  const next = { ...getBoardSession(key), ...patch };
  sessions.set(key, next);
  return next;
}

export function clearBoardSession(key = DEFAULT_KEY) {
  sessions.set(key, emptySession());
  return sessions.get(key);
}

export function evictBoardSession(key = DEFAULT_KEY) {
  sessions.delete(key);
}

export function getFocusedJobId(key = DEFAULT_KEY) {
  return sessions.get(key)?.focused_job_id || null;
}
