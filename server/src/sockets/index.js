import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { trackBoardJoin, trackBoardLeave } from './boardScreens.js';

let io;

export function getIO() {
  return io || null;
}

async function resolveSocketUser(token) {
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active, full_name')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile?.is_active) return null;
  return { id: profile.id, role: profile.role, full_name: profile.full_name };
}

export function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const boardKey =
      socket.handshake.auth?.key || socket.handshake.auth?.boardKey || socket.handshake.query?.key;
    const label = socket.handshake.auth?.label || socket.handshake.query?.label;
    const preview = socket.handshake.auth?.preview ?? socket.handshake.query?.preview;
    socket.data.user = await resolveSocketUser(token);
    socket.data.boardLabel = typeof label === 'string' && label.trim() ? label.trim() : '';
    socket.data.preview = preview === true || preview === '1' || preview === 'true';
    if (boardKey) {
      const { data } = await supabase.from('settings').select('value').eq('key', 'board_key').maybeSingle();
      socket.data.boardAccess = Boolean(data?.value) && String(data.value) === String(boardKey);
    }
    next();
  });

  io.on('connection', (socket) => {
    const role = socket.data.user?.role;

    if (role === 'admin') {
      socket.join('admin');
      socket.join('staff');
    } else if (role === 'staff') {
      socket.join('staff');
    }

    if (socket.data.boardAccess) {
      socket.join('board');
      trackBoardJoin(socket, io);
    }

    socket.on('join', (room) => {
      if (room === 'board') {
        if (socket.data.boardAccess || ['admin', 'staff'].includes(role)) {
          socket.join('board');
          trackBoardJoin(socket, io);
        }
        return;
      }
      if (room === 'staff' && ['staff', 'admin'].includes(role)) {
        socket.join('staff');
      }
      if (room === 'admin' && role === 'admin') {
        socket.join('admin');
      }
    });

    socket.on('disconnect', () => {
      trackBoardLeave(socket.id, io);
    });

    logger.info(`socket connected ${socket.id} role=${role || 'guest'}`);
  });

  return io;
}
