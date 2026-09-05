import { useCallback, useEffect, useState } from 'react';
import * as dashboardService from '../services/dashboard.service.js';
import { addDaysIso, isSameDay, isToday, todayIso } from '../utils/date.js';

export function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      const [admin, jobsResult, voiceResult] = await Promise.all([
        dashboardService.getAdminDashboard(),
        dashboardService.listJobs({ status: 'active', limit: 100, page: 1 }),
        dashboardService.listVoiceHistory({ limit: 20, page: 1 }),
      ]);

      const jobs = jobsResult.items || [];
      const voiceItems = voiceResult.items || [];
      const today = todayIso();
      const until = addDaysIso(3);

      const dueToday = jobs.filter((job) => isToday(job.due_date));
      const overdue = jobs.filter((job) => job.due_date && job.due_date < today);
      const dueSoon = jobs
        .filter((job) => job.due_date && job.due_date <= until)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));

      const overdueByStage = overdue.reduce((acc, job) => {
        const key = job.stage?.id || job.stage_id;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const voiceToday = voiceItems.filter((item) => isSameDay(item.created_at));
      const pendingVoice = voiceItems.filter((item) => item.status === 'pending_confirmation');
      const executed = voiceItems.filter((item) => item.status === 'executed').length;
      const understoodPct = voiceItems.length
        ? Math.round((executed / voiceItems.length) * 100)
        : 0;

      setData({
        admin,
        jobs,
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
      });
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
