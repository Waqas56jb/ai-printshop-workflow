import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { trackBoardJoin, trackBoardLeave } from './boardScreens.js';
import { evictBoardSession } from './boardSession.js';

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
      // Mirror app.js's Express CORS check exactly — Socket.IO does its own
      // separate CORS negotiation, so leaving this as a flat allowlist (no
      // *.vercel.app fallback) silently rejected the deployed frontends'
      // socket connections even though their plain REST calls worked fine.
      origin(origin, callback) {
        if (!origin || env.clientOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin not allowed: ${origin}`));
      },
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
    const { data: settingRows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['board_key', 'board_public']);
    const settingMap = Object.fromEntries((settingRows || []).map((row) => [row.key, row.value]));
    const boardPublic =
      settingMap.board_public === undefined ||
      settingMap.board_public === null ||
      (settingMap.board_public !== false &&
        settingMap.board_public !== 'false' &&
        settingMap.board_public !== 0);
    socket.data.boardAccess =
      boardPublic || (Boolean(boardKey) && Boolean(settingMap.board_key) && String(settingMap.board_key) === String(boardKey));
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

    // Voice-driven TV board: a card clicked in ConfirmOverlay re-runs the focus
    // for that job; keyboard/voice next-prev asks the server to re-send the full
    // job payload for whichever job the board decided to focus next. Both are
    // lazy-imported to avoid a static import cycle with sockets/events.js.
    socket.on('board:confirm_reply', async (payload) => {
      if (!socket.rooms.has('board')) return;
      try {
        const { confirmFocus } = await import('../modules/voice/boardVoice.service.js');
        await confirmFocus(payload?.job_id);
      } catch (error) {
        logger.error(`board confirm_reply failed: ${error.message}`);
      }
    });

    socket.on('board:focus_request', async (payload) => {
      if (!socket.rooms.has('board')) return;
      try {
        const { focusJob } = await import('../modules/voice/boardVoice.service.js');
        await focusJob(payload?.job_id);
      } catch (error) {
        logger.error(`board focus_request failed: ${error.message}`);
      }
    });

    socket.on('board:move_stage_request', async (payload) => {
      if (!socket.rooms.has('board')) return;
      try {
        const { moveFocusedStage } = await import('../modules/voice/boardVoice.service.js');
        await moveFocusedStage(payload?.direction === 'prev' ? 'prev' : 'next');
      } catch (error) {
        logger.error(`board move_stage_request failed: ${error.message}`);
      }
    });

    socket.on('disconnect', () => {
      trackBoardLeave(socket.id, io);
      const remaining = io.sockets.adapter.rooms.get('board');
      if (!remaining || remaining.size === 0) {
        evictBoardSession();
      }
    });

    logger.info(`socket connected ${socket.id} role=${role || 'guest'}`);
  });

  return io;
}
