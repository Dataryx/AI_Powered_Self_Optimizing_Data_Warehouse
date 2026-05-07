import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export type WorkloadClustersPayload = Awaited<ReturnType<typeof api.getWorkloadClusters>>;
export type CacheCandidatesPayload = Awaited<ReturnType<typeof api.getCacheCandidates>>;

/** Recent query_logs sample size for clustering assignment (API default is fine at 2k–5k). */
const WORKLOAD_CLUSTER_SAMPLE = 5000;
/** Rows scanned to rank cache templates; candidate list length and probability floor. */
const CACHE_LOGS_LIMIT = 8000;
const CACHE_LIST_LIMIT = 25;
const CACHE_THRESHOLD = 0;

export function useWorkloadCacheInsights() {
  const [workload, setWorkload] = useState<WorkloadClustersPayload | null>(null);
  const [cache, setCache] = useState<CacheCandidatesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    return Promise.all([
      api.getWorkloadClusters(WORKLOAD_CLUSTER_SAMPLE),
      api.getCacheCandidates({
        logsLimit: CACHE_LOGS_LIMIT,
        limit: CACHE_LIST_LIMIT,
        threshold: CACHE_THRESHOLD,
      }),
    ])
      .then(([w, c]) => {
        setWorkload(w);
        setCache(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { workload, cache, loading, error, refetch };
}
