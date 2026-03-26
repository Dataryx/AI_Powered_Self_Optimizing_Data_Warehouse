import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useAnalyticsData() {
  const [data, setData] = useState<{
    queryPerformance?: any[];
    optimizationHistory?: any[];
    recommendations?: any[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perf, history, recs] = await Promise.allSettled([
        api.getQueryPerformance({ limit: 100 }),
        api.getOptimizationHistory(100),
        api.getOptimizationRecommendations(),
      ]);
      setData({
        queryPerformance: perf.status === 'fulfilled' ? (Array.isArray(perf.value) ? perf.value : perf.value?.queries ?? []) : [],
        optimizationHistory: history.status === 'fulfilled' ? (Array.isArray(history.value) ? history.value : history.value?.history ?? []) : [],
        recommendations: recs.status === 'fulfilled' ? (Array.isArray(recs.value) ? recs.value : recs.value?.recommendations ?? []) : [],
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  return { data, loading, error, refetch: fetchAll };
}






