import { useCallback, useEffect, useState } from 'react';
import * as dashboardService from '../services/dashboard.service.js';
import { isSameDay } from '../utils/date.js';
import { readCache, writeCache } from '../utils/pageCache.js';

const CACHE_KEY = 'admin-dashboard';

export function useDashboard() {
  const cached = readCache(CACHE_KEY);
  const [data, setData] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);

  const refetch = useCallback(async ({ silent = false } = {}) => {
    if (!silent && !readCache(CACHE_KEY)) setLoading(true);
    try {
      const admin = await dashboardService.getAdminDashboard();
      const voiceItems = admin.recent_voice_commands || [];
      const dueSoon = admin.due_soon || [];
      const dueToday = admin.due_today || [];
      const overdue = admin.overdue || [];

      const overdueByStage = overdue.reduce((acc, job) => {
        const key = job.stage?.id || job.stage_id;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const voiceToday = voiceItems.filter((item) => isSameDay(item.created_at));
      const pendingVoice = voiceItems.filter((item) => item.status === 'pending_confirmation');
      const executed = voiceItems.filter((item) => item.status === 'executed').length;
      const understoodPct = voiceItems.length ? Math.round((executed / voiceItems.length) * 100) : 0;

      const next = {
        admin,
        jobs: dueSoon,
        stages: admin.jobs_per_stage || [],
        totals: admin.totals || {},
        dueToday,
        overdue,
        dueSoon,
        overdueByStage,
        completedThisWeek: admin.completed_this_week || 0,
        voiceToday,
        pendingVoice,
        voiceCommands: voiceItems,
        staff: admin.staff_activity || [],
        understoodPct,
      };
      writeCache(CACHE_KEY, next);
      setData(next);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch({ silent: Boolean(cached) });
  }, [refetch]);

  return { data, loading, error, refetch };
}
