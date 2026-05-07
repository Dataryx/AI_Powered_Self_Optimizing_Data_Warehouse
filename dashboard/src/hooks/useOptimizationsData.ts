import { useMemo, useCallback, useState } from 'react';
import { useOptimizationRealtimeWebSocket } from './useOptimizationRealtimeWebSocket';
import { useQueryPerformanceFetch } from './useQueryPerformanceFetch';

const REC_LIMIT = 100;

/** Fixed window for the optimization stream only; UI query-performance uses `performanceDays` via REST. */
const STREAM_INTERNAL_PERFORMANCE_DAYS = 7;

export type OptimizationStreamMeta = {
  lastUpdate: Date | null;
  wsConnected: boolean;
  usingFallback: boolean;
};

/**
 * Live optimization data: one WebSocket (or HTTP polling) for recommendations + history.
 * Query performance for the selected period is loaded separately so changing the time range
 * does not reconnect the stream or reload other panels.
 */
export function useOptimizationsData(performanceDays: number) {
  const [refreshKey, setRefreshKey] = useState(0);
  const opt = useOptimizationRealtimeWebSocket({
    performanceDays: STREAM_INTERNAL_PERFORMANCE_DAYS,
    performanceLimit: REC_LIMIT,
    recommendationsLimit: REC_LIMIT,
    historyLimit: REC_LIMIT,
    wsIntervalMs: 2000,
    fallbackIntervalMs: 2000,
    refreshKey,
  });

  const queryPerf = useQueryPerformanceFetch(performanceDays, {
    limit: REC_LIMIT,
    refreshKey,
  });

  const data = useMemo(
    () => ({
      recommendations: [
        ...(opt.indexRecommendations ?? []),
        ...(opt.partitionRecommendations ?? []),
      ],
      recommendationsDebug: (opt.snapshot as { debug?: unknown } | null)?.debug ?? (opt.snapshot as any)?.index?.debug,
      queryPerformance: queryPerf.metrics,
      queryPerformanceMeta: {
        usedUnboundedFallback: queryPerf.usedUnboundedFallback,
        ...(queryPerf.contractMeta ?? {}),
      },
      history: opt.history ?? [],
    }),
    [
      opt.indexRecommendations,
      opt.partitionRecommendations,
      opt.snapshot,
      queryPerf.metrics,
      queryPerf.usedUnboundedFallback,
      queryPerf.contractMeta,
      opt.history,
    ],
  );

  const loading = opt.indexRecommendations === null && !opt.error;
  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  const stream: OptimizationStreamMeta = {
    lastUpdate: opt.lastUpdate,
    wsConnected: opt.wsConnected,
    usingFallback: opt.usingFallback,
  };

  return {
    data,
    loading,
    error: opt.error,
    queryPerformanceLoading: queryPerf.loading,
    queryPerformanceError: queryPerf.error,
    refetch,
    stream,
  };
}
