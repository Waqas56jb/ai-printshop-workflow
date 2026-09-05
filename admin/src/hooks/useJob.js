import { useCallback, useEffect, useState } from 'react';
import { listVoiceHistory } from '../services/dashboard.service.js';
import { getJob, listJobs } from '../services/jobs.service.js';
import { useSocket } from './useSocket.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveJobId(id) {
  if (!id) return null;
  if (UUID.test(id)) return id;
  const result = await listJobs({ search: id, page: 1, limit: 20 });
  const match = (result.items || []).find((job) => job.job_number?.toLowerCase() === id.toLowerCase());
  return match?.id || null;
}

export function useJob(id) {
  const [job, setJob] = useState(null);
  const [voiceCommands, setVoiceCommands] = useState([]);
  const [resolvedId, setResolvedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      const jobId = await resolveJobId(id);
      if (!jobId) {
        setJob(null);
        setResolvedId(null);
        setVoiceCommands([]);
        setError('not_found');
        return;
      }
      const [data, voice] = await Promise.all([getJob(jobId), listVoiceHistory({ page: 1, limit: 100 })]);
      setResolvedId(jobId);
      setJob(data);
      setVoiceCommands((voice.items || []).filter((item) => item.job_id === jobId));
      setError(null);
    } catch (err) {
      setJob(null);
      setVoiceCommands([]);
      setError(err.response?.status === 404 || err.response?.status === 400 ? 'not_found' : err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  const onLive = useCallback(
    (payload) => {
      const eventId = payload?.id || payload?.job?.id || payload?.job_id;
      if (eventId && resolvedId && eventId !== resolvedId) return;
      refetch();
    },
    [refetch, resolvedId]
  );
  useSocket(onLive);

  return { job, voiceCommands, loading, error, refetch };
}
