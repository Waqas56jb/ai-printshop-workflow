import { useCallback, useEffect, useState } from 'react';
import { duePresetToRange, listJobs } from '../services/jobs.service.js';
import { readCache, writeCache } from '../utils/pageCache.js';

const PAGE_SIZE = 20;

function cacheKey(params) {
  return `admin-jobs:${JSON.stringify(params)}`;
}

export function useJobs(params) {
  const key = cacheKey({
    page: Number(params.page || 1),
    stage: params.stage || '',
    priority: params.priority || '',
    assigned: params.assigned || '',
    due: params.due || '',
    search: params.search || '',
    customer: params.customer || '',
  });
  const cached = readCache(key, 60_000);
  const [jobs, setJobs] = useState(cached?.items || []);
  const [total, setTotal] = useState(cached?.total || 0);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);

  const refetch = useCallback(async ({ silent = false } = {}) => {
    if (!silent && !readCache(key, 60_000)) setLoading(true);
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
      const items = result.items || [];
      writeCache(key, { items, total: result.total || 0 });
      setJobs(items);
      setTotal(result.total || 0);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [params.stage, params.priority, params.assigned, params.due, params.search, params.page, params.customer, key]);

  useEffect(() => {
    refetch({ silent: Boolean(cached) });
  }, [refetch]);

  return { jobs, total, page: Number(params.page || 1), limit: PAGE_SIZE, loading, error, refetch };
}
