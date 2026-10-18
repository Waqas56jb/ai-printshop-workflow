import { useCallback, useEffect, useRef, useState } from 'react';
import { listJobs, listStages } from '../services/jobs.service.js';
import { readCache, writeCache } from '../utils/pageCache.js';
import { sortStages } from '../utils/plain.js';
import { useSocket } from './useSocket.js';

const CACHE_KEY = 'simple-jobs';
const PAGE = 100;

async function listAllActive() {
  const items = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await listJobs({ status: 'active', page, limit: PAGE });
    items.push(...(result.items || []));
    if (items.length >= (result.total || 0) || !(result.items || []).length) break;
  }
  return items;
}

// Stages + every active job + the last 20 finished jobs, kept live over the socket.
// `version` bumps on every live change so an open job sheet can reload too.
export function useJobBoard() {
  const cached = readCache(CACHE_KEY, 120_000);
  const [stages, setStages] = useState(() => sortStages(cached?.stages || []));
  const [active, setActive] = useState(cached?.active || []);
  const [done, setDone] = useState(cached?.done || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const timer = useRef(null);

  const refetch = useCallback(async () => {
    try {
      const [nextStages, nextActive, finished] = await Promise.all([
        listStages(),
        listAllActive(),
        listJobs({ status: 'completed', sort: 'completed', page: 1, limit: 20 }),
      ]);
      const nextDone = finished.items || [];
      writeCache(CACHE_KEY, { stages: nextStages, active: nextActive, done: nextDone });
      setStages(sortStages(nextStages || []));
      setActive(nextActive);
      setDone(nextDone);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Socket events arrive in bursts (one per room, plus voice side effects) — coalesce them.
  const onLive = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setVersion((value) => value + 1);
      refetch();
    }, 250);
  }, [refetch]);
  useSocket(onLive);

  // The "+ New job" dialog lives in the top bar; it announces new jobs this way.
  useEffect(() => {
    window.addEventListener('jobs:changed', onLive);
    return () => {
      window.removeEventListener('jobs:changed', onLive);
      clearTimeout(timer.current);
    };
  }, [onLive]);

  return { stages, jobs: [...active, ...done], loading, error, version, refetch };
}

export function announceJobsChanged() {
  window.dispatchEvent(new Event('jobs:changed'));
}
