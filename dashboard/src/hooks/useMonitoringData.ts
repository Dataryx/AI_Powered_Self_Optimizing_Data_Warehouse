import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

export function useMonitoringData() {
  const POLL_INTERVAL_MS = 15000;
  const [data, setData] = useState<{
    jobs?: any[];
    pipeline?: any;
    freshness?: any;
    errors?: any[];
    dataQuality?: any;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const fetchAll = useCallback(async (options?: { silent?: boolean }) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (!options?.silent) {
      setLoading(true);
    }
    if (!options?.silent) {
      setError(null);
    }

    try {
      const [jobs, pipeline, freshness, errors, dataQuality] = await Promise.allSettled([
        api.getETLJobs(),
        api.getPipelineDAG(),
        api.getDataFreshness(),
        api.getETLErrors(),
        api.getDataQualityMetrics(),
      ]);
      setData({
        jobs: jobs.status === 'fulfilled' ? (Array.isArray(jobs.value) ? jobs.value : jobs.value?.jobs ?? []) : [],
        pipeline: pipeline.status === 'fulfilled' ? pipeline.value : undefined,
        freshness: freshness.status === 'fulfilled' ? freshness.value : undefined,
        errors: errors.status === 'fulfilled' ? (Array.isArray(errors.value) ? errors.value : errors.value?.errors ?? []) : [],
        dataQuality: dataQuality.status === 'fulfilled' ? dataQuality.value : undefined,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load monitoring data');
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    const id = setInterval(() => {
      void fetchAll({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}





