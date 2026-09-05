import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config.js';
import { useAuthStore } from '../store/authStore.js';

const EVENTS = [
  'job:created',
  'job:updated',
  'job:moved',
  'job:deleted',
  'voice:command',
  'board:refresh',
  'board:screens',
];

export function useSocket(onEvent) {
  const token = useAuthStore((state) => state.session?.access_token);

  useEffect(() => {
    if (!token || !onEvent) return undefined;

    const socket = io(API_URL, {
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('join', 'admin');
    });

    EVENTS.forEach((event) => {
      socket.on(event, (payload) => onEvent(payload, event));
    });

    return () => {
      socket.disconnect();
    };
  }, [token, onEvent]);
}
