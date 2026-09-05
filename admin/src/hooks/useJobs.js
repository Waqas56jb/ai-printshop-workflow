import { useCallback, useEffect, useState } from 'react';
import { duePresetToRange, listArtworks, listJobs } from '../services/jobs.service.js';

const PAGE_SIZE = 20;

export function useJobs(params) {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const query = {
        page: Number(params.page || 1),
        limit: PAGE_SIZE,
        search: params.search || undefined,
        priority: params.priority || undefined,
        customer: params.customer || undefined,
        assigned: params.assigned || undefined,
        ...duePresetToRange(params.due),
      };

      if (params.stage === 'delivered') {
        query.status = 'completed';
      } else if (params.stage) {
        query.status = 'active';
        query.stage = params.stage;
      } else if (!params.customer) {
        query.status = 'active';
      }

      const result = await listJobs(query);
      let items = result.items || [];
      setTotal(result.total || 0);

      const withArt = await Promise.all(
        items.map(async (job) => {
          try {
            const artworks = await listArtworks(job.id);
            return { ...job, artworks: artworks || [] };
          } catch {
            return { ...job, artworks: [] };
          }
        })
      );

      setJobs(withArt);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [params.stage, params.priority, params.assigned, params.due, params.search, params.page, params.customer]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { jobs, total, page: Number(params.page || 1), limit: PAGE_SIZE, loading, error, refetch };
}
