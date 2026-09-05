import { useCallback, useEffect, useRef, useState } from 'react';
import { getBoard } from '../services/api.js';
import { useBoardSocket } from './useBoardSocket.js';

export function useBoard(key, { label = '', preview = false } = {}) {
  const [data, setData] = useState(null);
  const [offline, setOffline] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const lastGood = useRef(null);
  const timer = useRef(null);

  const fetchBoard = useCallback(async () => {
    try {
      const payload = await getBoard(key);
      if (!payload) return;
      lastGood.current = payload;
      setData(payload);
      setOffline(false);
      setInvalid(false);
      setUpdatedAt(new Date());
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        setInvalid(true);
        return;
      }
      if (lastGood.current) {
        setData(lastGood.current);
      }
      setOffline(true);
    }
  }, [key]);

  const requestFetch = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      fetchBoard();
    }, 80);
  }, [fetchBoard]);

  useEffect(() => {
    fetchBoard();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fetchBoard]);

  const seconds = data?.settings?.refresh_seconds || 30;

  useEffect(() => {
    if (invalid) return undefined;
    const id = setInterval(fetchBoard, seconds * 1000);
    return () => clearInterval(id);
  }, [invalid, seconds, fetchBoard]);

  useBoardSocket(Boolean(data) && !invalid, requestFetch, { key, label, preview });

  return { data, offline, invalid, updatedAt, refetch: fetchBoard };
}
