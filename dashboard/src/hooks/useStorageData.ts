import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useStorageData() {
  const [data, setData] = useState<{
    utilization?: any;
    growth?: any;
    compression?: any;
    cache?: any;
    resources?: any;
    cost?: any;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [utilization, growth, compression, cache, resources, cost] = await Promise.allSettled([
        api.getStorageUtilization(),
        api.getGrowthTrends(30),
        api.getCompressionStats(),
        api.getCachePerformance(),
        api.getResourceAllocation(),
        api.getCostTracking(),
      ]);
      setData({
        utilization: utilization.status === 'fulfilled' ? utilization.value : undefined,
        growth: growth.status === 'fulfilled' ? growth.value : undefined,
        compression: compression.status === 'fulfilled' ? compression.value : undefined,
        cache: cache.status === 'fulfilled' ? cache.value : undefined,
        resources: resources.status === 'fulfilled' ? resources.value : undefined,
        cost: cost.status === 'fulfilled' ? cost.value : undefined,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load storage data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  return { data, loading, error, refetch: fetchAll };
}





