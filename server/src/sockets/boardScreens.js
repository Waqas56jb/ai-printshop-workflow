const MAX_SCREENS = 10;

const screens = new Map();
let lastFetchAt = null;

function parseUserAgent(ua = '') {
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  let os = 'Unknown';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return {
    label: `${browser} on ${os}`,
    browser,
    device: mobile ? 'mobile' : 'desktop',
  };
}

function prune() {
  const list = [...screens.values()].sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen));
  const online = list.filter((row) => row.online);
  const offline = list.filter((row) => !row.online);
  const keep = [...online, ...offline].slice(0, MAX_SCREENS);
  screens.clear();
  keep.forEach((row) => screens.set(row.socket_id, row));
}

export function noteBoardFetch() {
  lastFetchAt = new Date().toISOString();
}

export function listScreens() {
  return [...screens.values()].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return new Date(b.last_seen) - new Date(a.last_seen);
  });
}

export function getBoardStats() {
  const online = listScreens().filter((row) => row.online);
  return {
    live: online.length > 0,
    screens_online: online.length,
    last_fetch_at: lastFetchAt,
  };
}

export function emitBoardScreens(io) {
  if (!io) return;
  const payload = listScreens();
  io.to('admin').to('staff').emit('board:screens', payload);
}

export function trackBoardJoin(socket, io) {
  if (socket.data.preview || !socket.data.boardAccess) return;
  const ua = socket.handshake.headers['user-agent'] || '';
  const parsed = parseUserAgent(ua);
  const now = new Date().toISOString();
  const existing = screens.get(socket.id);
  screens.set(socket.id, {
    socket_id: socket.id,
    label: socket.data.boardLabel || parsed.label,
    browser: parsed.browser,
    device: parsed.device,
    connected_at: existing?.connected_at || now,
    last_seen: now,
    online: true,
  });
  prune();
  emitBoardScreens(io);
}

export function trackBoardLeave(socketId, io) {
  const existing = screens.get(socketId);
  if (!existing) return;
  screens.set(socketId, {
    ...existing,
    online: false,
    last_seen: new Date().toISOString(),
  });
  prune();
  emitBoardScreens(io);
}
