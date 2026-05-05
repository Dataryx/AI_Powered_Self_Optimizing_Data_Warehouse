import { useMemo, useCallback, useState } from 'react';
import { useOptimizationRealtimeWebSocket } from './useOptimizationRealtimeWebSocket';

const REC_LIMIT = 100;

export type OptimizationStreamMeta = {
  lastUpdate: Date | null;
  wsConnected: boolean;
  usingFallback: boolean;
};

/**
 * Live optimization data: one WebSocket (or HTTP polling) shared across the Optimizations page.
 * No dummy/sample rows — empty panels mean the API returned no data.
 */
export function useOptimizationsData(performanceDays: number) {
  const [refreshKey, setRefreshKey] = useState(0);
  const opt = useOptimizationRealtimeWebSocket({
    performanceDays,
    performanceLimit: REC_LIMIT,
    recommendationsLimit: REC_LIMIT,
    historyLimit: REC_LIMIT,
    wsIntervalMs: 2000,
    fallbackIntervalMs: 2000,
    refreshKey,
  });

  const data = useMemo(
    () => ({
      recommendations: [
        ...(opt.indexRecommendations ?? []),
        ...(opt.partitionRecommendations ?? []),
      ],
      recommendationsDebug: (opt.snapshot as { debug?: unknown } | null)?.debug ?? (opt.snapshot as any)?.index?.debug,
      queryPerformance: opt.performanceMetrics,
      queryPerformanceMeta: {
        usedUnboundedFallback: opt.performanceUsedUnboundedFallback,
      },
      history: opt.history ?? [],
    }),
    [
      opt.indexRecommendations,
      opt.partitionRecommendations,
      opt.snapshot,
      opt.performanceMetrics,
      opt.performanceUsedUnboundedFallback,
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

  return { data, loading, error: opt.error, refetch, stream };
}
