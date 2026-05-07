import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { normalizeQueryPerformance, utcPerformanceDateRange } from '../utils/queryPerformance';

/**
 * Fetches query-performance metrics for a UTC calendar window (aligned with the REST API).
 * Independent of the optimization WebSocket so changing the period does not reload recommendations/history.
 */
export function useQueryPerformanceFetch(
  performanceDays: number,
  options: { limit?: number; refreshKey?: number } = {},
) {
  const limit = options.limit ?? 100;
  const refreshKey = options.refreshKey ?? 0;
  const range = useMemo(() => utcPerformanceDateRange(performanceDays), [performanceDays]);

  const [metrics, setMetrics] = useState<unknown[]>([]);
  const [usedUnboundedFallback, setUsedUnboundedFallback] = useState(false);
  const [contractMeta, setContractMeta] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const perfRes = await api.getQueryPerformance({
          start_date: range.startDate,
          end_date: range.endDate,
          limit,
        });
        if (cancelled) return;
        setMetrics(normalizeQueryPerformance(perfRes));
        setUsedUnboundedFallback(Boolean((perfRes as { used_unbounded_fallback?: boolean })?.used_unbounded_fallback));
        const rawMeta = (perfRes as { metadata?: Record<string, unknown> })?.metadata;
        setContractMeta(rawMeta && typeof rawMeta === 'object' ? rawMeta : null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [limit, range.startDate, range.endDate, refreshKey]);

  return { metrics, usedUnboundedFallback, contractMeta, loading, error };
}
