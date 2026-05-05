/**
 * Single WebSocket stream for optimization snapshots + HTTP prefetch / polling fallback.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, buildOptimizationStreamWebSocketUrl } from '../services/api';
import { normalizeQueryPerformance, utcPerformanceDateRange } from '../utils/queryPerformance';

type OptimizationRecommendationsPayload = {
  recommendations?: unknown[];
  total?: number;
  debug?: unknown;
};

type OptimizationHistoryPayload = {
  history?: unknown[];
  total?: number;
};

type QueryPerformancePayload = {
  queries?: unknown[];
  metrics?: unknown[];
  total?: number;
  used_unbounded_fallback?: boolean;
};

type OptimizationSnapshot = {
  type?: string;
  timestamp?: string;
  index?: OptimizationRecommendationsPayload;
  partition?: OptimizationRecommendationsPayload;
  history?: OptimizationHistoryPayload;
  performance?: QueryPerformancePayload;
  debug?: unknown;
};

interface UseOptimizationRealtimeWebSocketOptions {
  performanceDays?: number;
  performanceLimit?: number;
  recommendationsLimit?: number;
  historyLimit?: number;
  wsIntervalMs?: number;
  fallbackIntervalMs?: number;
  refreshKey?: number;
}

export function useOptimizationRealtimeWebSocket(
  options: UseOptimizationRealtimeWebSocketOptions = {},
) {
  const performanceDays = options.performanceDays ?? 7;
  const performanceLimit = options.performanceLimit ?? 100;
  const recommendationsLimit = options.recommendationsLimit ?? 100;
  const historyLimit = options.historyLimit ?? 100;
  const wsIntervalMs = options.wsIntervalMs ?? 2000;
  const fallbackIntervalMs = options.fallbackIntervalMs ?? wsIntervalMs;
  const refreshKey = options.refreshKey ?? 0;

  const [wsConnected, setWsConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<OptimizationSnapshot | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const performanceRange = useMemo(
    () => utcPerformanceDateRange(performanceDays),
    [performanceDays],
  );

  const fetchSnapshotViaHttp = useCallback(async (): Promise<OptimizationSnapshot> => {
    const recCap = Math.min(Math.max(recommendationsLimit * 2, recommendationsLimit), 250);
    const [combinedRecs, historyRes, perfRes] = await Promise.all([
      api.getOptimizationRecommendations(undefined, 'pending', recCap),
      api.getOptimizationHistory(historyLimit),
      api.getQueryPerformance({
        start_date: performanceRange.startDate,
        end_date: performanceRange.endDate,
        limit: performanceLimit,
      }),
    ]);

    const all = Array.isArray((combinedRecs as { recommendations?: unknown[] })?.recommendations)
      ? (combinedRecs as { recommendations: unknown[] }).recommendations
      : [];
    const debug = (combinedRecs as { debug?: unknown })?.debug;
    const indexRows = all.filter(
      (r) => String((r as { type?: string })?.type ?? 'index').toLowerCase() !== 'partition',
    );
    const partitionRows = all.filter(
      (r) => String((r as { type?: string })?.type ?? '').toLowerCase() === 'partition',
    );

    return {
      type: 'optimization_snapshot',
      timestamp: new Date().toISOString(),
      index: {
        recommendations: indexRows.slice(0, recommendationsLimit),
        total: indexRows.length,
        debug,
      },
      partition: {
        recommendations: partitionRows.slice(0, recommendationsLimit),
        total: partitionRows.length,
        debug,
      },
      history: historyRes as OptimizationHistoryPayload,
      performance: perfRes as QueryPerformancePayload,
      debug,
    };
  }, [
    performanceLimit,
    performanceRange.endDate,
    performanceRange.startDate,
    recommendationsLimit,
    historyLimit,
  ]);

  useEffect(() => {
    let cancelled = false;

    // Load recommendations immediately via REST — do not wait on WebSocket (WS can be slow or stall
    // while the socket stays "open" before the first frame, which left the UI stuck on loading).
    void (async () => {
      try {
        const snap = await fetchSnapshotViaHttp();
        if (!cancelled) {
          setSnapshot(snap);
          setLastUpdate(new Date());
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    const wsUrl = buildOptimizationStreamWebSocketUrl(
      `performance_days=${performanceDays}` +
        `&performance_limit=${performanceLimit}` +
        `&recommendations_limit=${recommendationsLimit}` +
        `&history_limit=${historyLimit}`,
    );

    const maxReconnectAttempts = 3;
    setError(null);
    setUsingFallback(false);
    setWsConnected(false);

    const stopFallback = () => {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };

    const startFallback = () => {
      stopFallback();
      setUsingFallback(true);
      void (async () => {
        try {
          const snap = await fetchSnapshotViaHttp();
          setSnapshot(snap);
          setLastUpdate(new Date());
          setError(null);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
        }
      })();
      fallbackIntervalRef.current = setInterval(async () => {
        try {
          const snap = await fetchSnapshotViaHttp();
          setSnapshot(snap);
          setLastUpdate(new Date());
          setError(null);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
        }
      }, fallbackIntervalMs);
    };

    const connect = () => {
      try {
        stopFallback();
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
          setUsingFallback(false);
          reconnectAttemptsRef.current = 0;
          setError(null);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.type === 'optimization_snapshot') {
              setSnapshot(data as OptimizationSnapshot);
              setLastUpdate(new Date());
              setError(null);
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onerror = () => {
          setWsConnected(false);
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectAttemptsRef.current += 1;
          if (reconnectAttemptsRef.current <= maxReconnectAttempts) {
            const timeoutMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 5000);
            reconnectTimeoutRef.current = setTimeout(connect, timeoutMs);
          } else {
            startFallback();
          }
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        startFallback();
      }
    };

    connect();

    return () => {
      cancelled = true;
      stopFallback();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [
    performanceDays,
    performanceLimit,
    recommendationsLimit,
    historyLimit,
    fetchSnapshotViaHttp,
    fallbackIntervalMs,
    refreshKey,
  ]);

  // After the first snapshot, treat missing buckets as [] so the page does not spin forever.
  const indexRecommendations =
    snapshot === null ? null : (snapshot.index?.recommendations ?? []);
  const partitionRecommendations =
    snapshot === null ? null : (snapshot.partition?.recommendations ?? []);
  const history = snapshot?.history?.history ?? null;
  const performanceMetrics = normalizeQueryPerformance(snapshot?.performance);
  const performanceUsedUnboundedFallback = Boolean(
    snapshot?.performance?.used_unbounded_fallback,
  );

  return {
    wsConnected,
    usingFallback,
    lastUpdate,
    error,
    snapshot,
    indexRecommendations,
    partitionRecommendations,
    history,
    performanceMetrics,
    performanceUsedUnboundedFallback,
  };
}
