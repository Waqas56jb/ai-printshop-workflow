import { useCallback, useEffect, useState } from 'react';
import { useSocket } from './useSocket.js';
import { getStaffDashboard, listPendingVoice } from '../services/today.service.js';
import { readCache, writeCache } from '../utils/pageCache.js';

const CACHE_KEY = 'staff-today';

export function useToday() {
  const cached = readCache(CACHE_KEY, 60_000);
  const [dashboard, setDashboard] = useState(cached?.dashboard || null);
  const [pending, setPending] = useState(cached?.pending || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');

  const refetch = useCallback(async ({ silent = false } = {}) => {
    if (!silent && !readCache(CACHE_KEY, 60_000)) setLoading(true);
    try {
      const [dash, voice] = await Promise.all([getStaffDashboard(), listPendingVoice()]);
      const pendingItems = voice.items || [];
      writeCache(CACHE_KEY, { dashboard: dash, pending: pendingItems });
      setDashboard(dash);
      setPending(pendingItems);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load today');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch({ silent: Boolean(cached) });
  }, [refetch]);

  useSocket(() => refetch({ silent: true }));

  return { dashboard, pending, loading, error, refetch };
}
