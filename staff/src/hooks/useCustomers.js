import { useCallback, useEffect, useState } from 'react';
import { getCustomer, getCustomerStats, listCustomers } from '../services/jobs.service.js';
import { readCache, writeCache } from '../utils/pageCache.js';
import { useSocket } from './useSocket.js';

function listKey(params) {
  return `customers:${JSON.stringify({
    page: Number(params.page || 1),
    limit: Number(params.limit || 20),
    search: params.search || '',
    filter: params.filter || '',
    sort: params.sort || 'recent',
  })}`;
}

export function useCustomers(params) {
  const key = listKey(params);
  const cached = readCache(key, 60_000);
  const [customers, setCustomers] = useState(cached?.items || []);
  const [stats, setStats] = useState(cached?.stats || readCache('customer-stats', 120_000));
  const [total, setTotal] = useState(cached?.total || 0);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);

  const refetch = useCallback(async ({ silent = false } = {}) => {
    if (!silent && !readCache(key, 60_000)) setLoading(true);
    try {
      const query = {
        page: Number(params.page || 1),
        limit: Number(params.limit || 20),
        search: params.search || undefined,
        filter: params.filter || undefined,
        sort: params.sort || 'recent',
      };
      const [list, nextStats] = await Promise.all([listCustomers(query), getCustomerStats()]);
      writeCache(key, { items: list.items || [], total: list.total || 0, stats: nextStats });
      writeCache('customer-stats', nextStats);
      setCustomers(list.items || []);
      setTotal(list.total || 0);
      setStats(nextStats);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [params.search, params.filter, params.sort, params.page, params.limit, key]);

  useEffect(() => {
    refetch({ silent: Boolean(cached) });
  }, [refetch]);

  const onLive = useCallback(() => {
    refetch({ silent: true });
  }, [refetch]);
  useSocket(onLive);

  return { customers, stats, total, page: Number(params.page || 1), limit: Number(params.limit || 20), loading, error, refetch };
}

export function useCustomer(id) {
  const [customer, setCustomer] = useState(() => (id ? readCache(`customer:${id}`, 60_000) : null));
  const [loading, setLoading] = useState(Boolean(id) && !readCache(`customer:${id}`, 60_000));
  const [error, setError] = useState(null);

  const refetch = useCallback(async ({ silent = false } = {}) => {
    if (!id) {
      setCustomer(null);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const data = await getCustomer(id);
      writeCache(`customer:${id}`, data);
      setCustomer(data);
      setError(null);
    } catch (err) {
      setCustomer(null);
      setError(err.response?.status === 404 ? 'not_found' : err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch({ silent: Boolean(id && readCache(`customer:${id}`, 60_000)) });
  }, [refetch, id]);

  const onLive = useCallback(() => {
    if (id) refetch({ silent: true });
  }, [id, refetch]);
  useSocket(onLive);

  return { customer, loading, error, refetch };
}
