import { useCallback, useEffect, useState } from 'react';
import { getCustomer, getCustomerStats, listCustomers } from '../services/jobs.service.js';
import { useSocket } from './useSocket.js';

export function useCustomers(params) {
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      const query = {
        page: Number(params.page || 1),
        limit: Number(params.limit || 20),
        search: params.search || undefined,
        filter: params.filter || undefined,
        sort: params.sort || 'recent',
      };
      const [list, nextStats] = await Promise.all([listCustomers(query), getCustomerStats()]);
      setCustomers(list.items || []);
      setTotal(list.total || 0);
      setStats(nextStats);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [params.search, params.filter, params.sort, params.page, params.limit]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  const onLive = useCallback(() => {
    refetch();
  }, [refetch]);
  useSocket(onLive);

  return { customers, stats, total, page: Number(params.page || 1), limit: Number(params.limit || 20), loading, error, refetch };
}

export function useCustomer(id) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setCustomer(null);
      setLoading(false);
      return;
    }
    try {
      const data = await getCustomer(id);
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
    setLoading(Boolean(id));
    refetch();
  }, [refetch, id]);

  const onLive = useCallback(() => {
    if (id) refetch();
  }, [id, refetch]);
  useSocket(onLive);

  return { customer, loading, error, refetch };
}
