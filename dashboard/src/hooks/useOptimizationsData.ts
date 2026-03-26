import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import {
  DUMMY_INDEX_RECOMMENDATIONS,
  DUMMY_PARTITION_RECOMMENDATIONS,
  DUMMY_QUERY_PERFORMANCE,
  DUMMY_OPTIMIZATION_HISTORY,
} from '../data/dummyOptimizationDashboard';

export type OptimizationDemoFlags = {
  indexRecommendations?: boolean;
  partitionRecommendations?: boolean;
  queryPerformance?: boolean;
  history?: boolean;
};

export function useOptimizationsData() {
  const [data, setData] = useState<{
    recommendations?: any[];
    queryPerformance?: any[];
    history?: any[];
    demoFlags?: OptimizationDemoFlags;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recs, perf, history] = await Promise.allSettled([
        api.getOptimizationRecommendations(),
        api.getQueryPerformance({ limit: 100 }),
        api.getOptimizationHistory(50),
      ]);
      let recsList = recs.status === 'fulfilled' ? (Array.isArray(recs.value) ? recs.value : recs.value?.recommendations ?? []) : [];
      let perfList = perf.status === 'fulfilled' ? (Array.isArray(perf.value) ? perf.value : perf.value?.queries ?? []) : [];
      let historyList = history.status === 'fulfilled' ? (Array.isArray(history.value) ? history.value : history.value?.history ?? []) : [];
      if (recs.status === 'rejected') {
        setError(recs.reason?.message ?? 'Optimization API unreachable. Is the backend running on the correct port?');
      }

      const demoFlags: OptimizationDemoFlags = {};
      const hasIndexRec = recsList.some((r: any) => r?.type !== 'partition');
      const hasPartitionRec = recsList.some((r: any) => r?.type === 'partition');
      if (!hasIndexRec) {
        recsList = [...recsList, ...DUMMY_INDEX_RECOMMENDATIONS];
        demoFlags.indexRecommendations = true;
      }
      if (!hasPartitionRec) {
        recsList = [...recsList, ...DUMMY_PARTITION_RECOMMENDATIONS];
        demoFlags.partitionRecommendations = true;
      }
      if (perfList.length === 0) {
        perfList = [...DUMMY_QUERY_PERFORMANCE];
        demoFlags.queryPerformance = true;
      }
      if (historyList.length === 0) {
        historyList = [...DUMMY_OPTIMIZATION_HISTORY];
        demoFlags.history = true;
      }

      setData({
        recommendations: recsList,
        queryPerformance: perfList,
        history: historyList,
        demoFlags,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load optimizations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  return { data, loading, error, refetch: fetchAll };
}






