import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config.js';

const EVENTS = ['board:refresh', 'job:created', 'job:updated', 'job:moved', 'job:deleted', 'voice:command'];

export function useBoardSocket(key, onRefresh, { label = '', preview = false } = {}) {
  useEffect(() => {
    if (!key || !onRefresh) return undefined;

    const socket = io(API_URL, {
      auth: { key, label, preview },
      query: { key, label, preview: preview ? '1' : '' },
    });

    socket.on('connect', () => {
      socket.emit('join', 'board');
      onRefresh();
    });

    EVENTS.forEach((event) => {
      socket.on(event, onRefresh);
    });

    return () => {
      socket.disconnect();
    };
  }, [key, onRefresh, label, preview]);
}
