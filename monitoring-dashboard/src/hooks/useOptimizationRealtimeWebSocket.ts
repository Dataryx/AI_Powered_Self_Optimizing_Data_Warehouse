/**
 * Optimization WebSocket hook
 * Streams real-time ML-derived optimization snapshots to the dashboard.
 *
 * Includes HTTP polling fallback when WebSocket is unavailable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiService, mlApiWebSocketUrl } from '../services/api';

type OptimizationRecommendationsPayload = {
  recommendations?: any[];
  total?: number;
};

type OptimizationHistoryPayload = {
  history?: any[];
  total?: number;
};

type QueryPerformancePayload = {
  queries?: any[];
  metrics?: any[];
  total?: number;
};

type OptimizationSnapshot = {
  type?: string;
  timestamp?: string;
  index?: OptimizationRecommendationsPayload;
  partition?: OptimizationRecommendationsPayload;
  history?: OptimizationHistoryPayload;
  performance?: QueryPerformancePayload;
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

  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const performanceRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - performanceDays);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [performanceDays]);

  const fetchSnapshotViaHttp = useCallback(async (): Promise<OptimizationSnapshot> => {
    const [indexRes, partitionRes, historyRes, perfRes] = await Promise.all([
      apiService.getOptimizationRecommendations('index', 'pending', recommendationsLimit),
      apiService.getOptimizationRecommendations('partition', 'pending', recommendationsLimit),
      apiService.getOptimizationHistory(historyLimit),
      apiService.getQueryPerformance(
        performanceRange.startDate,
        performanceRange.endDate,
        undefined,
        performanceLimit,
      ),
    ]);

    return {
      type: 'optimization_snapshot',
      timestamp: new Date().toISOString(),
      index: indexRes as OptimizationRecommendationsPayload,
      partition: partitionRes as OptimizationRecommendationsPayload,
      history: historyRes as OptimizationHistoryPayload,
      performance: perfRes as QueryPerformancePayload,
    };
  }, [performanceLimit, performanceRange.endDate, performanceRange.startDate, recommendationsLimit, historyLimit]);

  /** Fast first paint: load the same snapshot as WS via HTTP before / between WS messages. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await fetchSnapshotViaHttp();
        if (!cancelled) {
          setSnapshot(snap);
          setLastUpdate(new Date());
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchSnapshotViaHttp]);

  useEffect(() => {
    const wsUrl =
      `${mlApiWebSocketUrl('ws/optimization-stream')}` +
      `?performance_days=${performanceDays}` +
      `&performance_limit=${performanceLimit}` +
      `&recommendations_limit=${recommendationsLimit}` +
      `&history_limit=${historyLimit}`;

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
          } catch (err) {
            // Ignore parse errors
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

  const indexRecommendations = snapshot?.index?.recommendations ?? null;
  const partitionRecommendations = snapshot?.partition?.recommendations ?? null;
  const history = snapshot?.history?.history ?? null;
  const performanceMetrics = snapshot?.performance?.metrics ?? snapshot?.performance?.queries ?? null;

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
  };
}

