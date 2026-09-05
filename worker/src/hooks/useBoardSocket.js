import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config.js';

const EVENTS = ['board:refresh', 'job:created', 'job:updated', 'job:moved', 'job:deleted', 'voice:command'];

export function useBoardSocket(enabled, onRefresh, { key = '', label = '', preview = false } = {}) {
  useEffect(() => {
    if (!enabled || !onRefresh) return undefined;

    const auth = { label, preview };
    const query = { label, preview: preview ? '1' : '' };
    if (key) {
      auth.key = key;
      query.key = key;
    }

    const socket = io(API_URL, { auth, query });

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
  }, [enabled, key, onRefresh, label, preview]);
}
