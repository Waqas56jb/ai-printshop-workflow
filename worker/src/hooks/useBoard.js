import { useCallback, useEffect, useRef, useState } from 'react';
import { getBoard } from '../services/api.js';
import { useBoardSocket } from './useBoardSocket.js';

const CACHE_KEY = 'worker-board-cache';

function readLocalBoard() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const row = JSON.parse(raw);
    if (!row?.data || Date.now() - row.at > 5 * 60_000) return null;
    return row.data;
  } catch {
    return null;
  }
}

function writeLocalBoard(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* ignore */
  }
}

export function useBoard(key, { label = '', preview = false } = {}) {
  const cached = readLocalBoard();
  const [data, setData] = useState(cached);
  const [offline, setOffline] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(cached ? new Date() : null);
  const lastGood = useRef(cached);
  const timer = useRef(null);

  const fetchBoard = useCallback(async () => {
    try {
      const payload = await getBoard(key);
      if (!payload) return;
      lastGood.current = payload;
      writeLocalBoard(payload);
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
