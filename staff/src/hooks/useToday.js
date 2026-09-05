import { useCallback, useEffect, useState } from 'react';
import { useSocket } from './useSocket.js';
import { getStaffDashboard, listPendingVoice } from '../services/today.service.js';

export function useToday() {
  const [dashboard, setDashboard] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    const [dash, voice] = await Promise.all([getStaffDashboard(), listPendingVoice()]);
    setDashboard(dash);
    setPending(voice.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch().catch((err) => {
      setError(err.response?.data?.message || err.message || 'Failed to load today');
      setLoading(false);
    });
  }, [refetch]);

  useSocket(refetch);

  return { dashboard, pending, loading, error, refetch };
}
