import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { normalizeQueryPerformance } from '../utils/queryPerformance';
import { parseHourlyCallsUtc7d, parseQueryLogRollup, type QueryLogRollup } from '../utils/analyticsDerived';
import { useRetentionDays } from './useMonitoringPreferences';

export type { QueryLogRollup };

const AUX_DATA_TIMEOUT_MS = 15000;

export type AnalyticsPageData = {
  queryPerformance: unknown[];
  queryPerformance7d: unknown[];
  queryPerformance1d: unknown[];
  /** Exact ``ml_optimization.query_logs`` rollups for 1d / 7d (Σ ``calls``, sample row count). */
  queryLogRollup1d: QueryLogRollup | null;
  queryLogRollup7d: QueryLogRollup | null;
  /** Σ ``calls`` per UTC clock hour over the 7d window (24 floats); matches database aggregation. */
  hourlyCallsUtc7d: number[] | null;
  peakUtcHour7d: number | null;
  peakHourTotalCalls7d: number | null;
  peakSampleLogId7d: number | null;
  optimizationHistory: unknown[];
  recommendations: unknown[];
  storageUtilization: unknown | null;
  /** GET /storage/cost — monthly_cost from measured bytes × API rate. */
  costTracking: unknown | null;
  /** Days covered by `queryPerformance` (long window from Monitoring → Data retention). */
  longWindowDays: number;
};

export type AnalyticsSectionHealth = {
  degraded: boolean;
  reason: string;
};

export type AnalyticsContractMeta = {
  dataWatermarkUtc: string | null;
  windowStartUtc: string | null;
  windowEndUtc: string | null;
  degraded: boolean;
  degradedReason: string;
};

function historyList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object' && Array.isArray((v as { history?: unknown[] }).history)) {
    return (v as { history: unknown[] }).history;
  }
  return [];
}

function recommendationsList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object' && Array.isArray((v as { recommendations?: unknown[] }).recommendations)) {
    return (v as { recommendations: unknown[] }).recommendations;
  }
  return [];
}

function timeoutError(label: string, timeoutMs: number): Error {
  return new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(timeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/** Bundle payload may use camelCase (dashboard bundle) or alternate shapes from older endpoints. */
function pickQueryPerfSlice(
  b: Record<string, unknown>,
  key: 'queryPerformance1d' | 'queryPerformance7d' | 'queryPerformance30d',
): unknown {
  const v = b[key];
  if (v != null) return v;
  const snake =
    key === 'queryPerformance1d'
      ? 'query_performance_1d'
      : key === 'queryPerformance7d'
        ? 'query_performance_7d'
        : 'query_performance_30d';
  return b[snake];
}

function pickOptimizationHistory(b: Record<string, unknown>): unknown {
  if (b.optimizationHistory != null) return b.optimizationHistory;
  return b.optimization_history;
}

function pickRecommendations(b: Record<string, unknown>): unknown {
  if (b.recommendations != null) return b.recommendations;
  return b.recommendation_list;
}

function parseAnalyticsMeta(raw: unknown): AnalyticsContractMeta {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const asStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
  return {
    dataWatermarkUtc: asStr(r.data_watermark_utc),
    windowStartUtc: asStr(r.window_start_utc),
    windowEndUtc: asStr(r.window_end_utc),
    degraded: Boolean(r.degraded_mode),
    degradedReason: typeof r.degraded_reason === 'string' ? r.degraded_reason : '',
  };
}

function parseHealthFromPayload(raw: unknown): AnalyticsSectionHealth {
  const meta = parseAnalyticsMeta(raw);
  return { degraded: meta.degraded, reason: meta.degradedReason };
}

function isPerfPayloadLike(v: unknown): boolean {
  if (Array.isArray(v)) return true;
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.metrics) || Array.isArray(o.queries);
}

export function useAnalyticsData() {
  const retentionDays = useRetentionDays();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [data, setData] = useState<AnalyticsPageData>({
    queryPerformance: [],
    queryPerformance7d: [],
    queryPerformance1d: [],
    queryLogRollup1d: null,
    queryLogRollup7d: null,
    hourlyCallsUtc7d: null,
    peakUtcHour7d: null,
    peakHourTotalCalls7d: null,
    peakSampleLogId7d: null,
    optimizationHistory: [],
    recommendations: [],
    storageUtilization: null,
    costTracking: null,
    longWindowDays: retentionDays,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contractMeta, setContractMeta] = useState<AnalyticsContractMeta>({
    dataWatermarkUtc: null,
    windowStartUtc: null,
    windowEndUtc: null,
    degraded: false,
    degradedReason: '',
  });
  const [sectionHealth, setSectionHealth] = useState<Record<string, AnalyticsSectionHealth>>({
    core: { degraded: false, reason: '' },
    storage: { degraded: false, reason: '' },
    cost: { degraded: false, reason: '' },
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Core bundle first (no client timeout — a short deadline was rejecting slow DBs and left charts empty).
      let b: Record<string, unknown>;
      try {
        b = (await api.getAnalyticsDashboardBundle({
          performanceLimit: 200,
          historyLimit: 200,
          recommendationsLimit: 120,
          performanceDaysLong: retentionDays,
        })) as Record<string, unknown>;
      } catch {
        // Fallback: older single-page bundle. Do NOT mirror one window into 1d/7d/30d slices,
        // because analytics timeline views require distinct real windows.
        const page = (await api.getAnalyticsPageBundle()) as Record<string, unknown>;
        b = {
          queryPerformance1d: [],
          queryPerformance7d: [],
          queryPerformance30d: [],
          optimizationHistory: page.optimizationHistory,
          recommendations: page.recommendations,
          metadata: {
            degraded_mode: true,
            degraded_reason: 'dashboard_bundle_failed_no_distinct_query_windows_available',
          },
        };
      }

      const rollup1 =
        parseQueryLogRollup(b.queryLogRollup1d) ?? parseQueryLogRollup(b.query_log_rollup_1d);
      const rollup7 =
        parseQueryLogRollup(b.queryLogRollup7d) ?? parseQueryLogRollup(b.query_log_rollup_7d);
      const hourlyUtc =
        parseHourlyCallsUtc7d(b.hourlyCallsUtc7d) ?? parseHourlyCallsUtc7d(b.hourly_calls_utc_7d);

      const pkHour = b.peakUtcHour7d ?? b.peak_utc_hour_7d;
      const pkTot = b.peakHourTotalCalls7d ?? b.peak_hour_total_calls_7d;
      const pkLog = b.peakSampleLogId7d ?? b.peak_sample_log_id_7d;
      const peakUtcHour7dParsed =
        typeof pkHour === 'number' && Number.isFinite(pkHour) ? Math.floor(pkHour) : null;
      const nTot = pkTot != null ? Number(pkTot) : NaN;
      const peakHourTotalParsed = Number.isFinite(nTot) ? nTot : null;
      const nLog = pkLog != null ? Number(pkLog) : NaN;
      const peakLogIdParsed = Number.isFinite(nLog) ? Math.floor(nLog) : null;

      const p1Raw = pickQueryPerfSlice(b, 'queryPerformance1d');
      const p7Raw = pickQueryPerfSlice(b, 'queryPerformance7d');
      const p30Raw = pickQueryPerfSlice(b, 'queryPerformance30d');
      if (!isPerfPayloadLike(p1Raw) || !isPerfPayloadLike(p7Raw) || !isPerfPayloadLike(p30Raw)) {
        throw new Error('Analytics contract mismatch: queryPerformance slices are missing/invalid');
      }

      setData((prev) => ({
        ...prev,
        queryPerformance: normalizeQueryPerformance(p30Raw),
        queryPerformance7d: normalizeQueryPerformance(p7Raw),
        queryPerformance1d: normalizeQueryPerformance(p1Raw),
        queryLogRollup1d: rollup1,
        queryLogRollup7d: rollup7,
        hourlyCallsUtc7d: hourlyUtc,
        peakUtcHour7d: peakUtcHour7dParsed,
        peakHourTotalCalls7d: peakHourTotalParsed,
        peakSampleLogId7d: peakLogIdParsed,
        optimizationHistory: historyList(pickOptimizationHistory(b)),
        recommendations: recommendationsList(pickRecommendations(b)),
        longWindowDays: retentionDays,
      }));
      const coreHealth = parseHealthFromPayload(b.metadata);
      setContractMeta(parseAnalyticsMeta(b.metadata));
      setSectionHealth((prev) => ({ ...prev, core: coreHealth }));
      setLastUpdatedAt(Date.now());

      // Storage/cost: non-blocking so charts are not delayed by slower endpoints.
      void Promise.allSettled([
        withTimeout(api.getStorageUtilization(), AUX_DATA_TIMEOUT_MS, 'Storage utilization'),
        withTimeout(api.getCostTracking(), AUX_DATA_TIMEOUT_MS, 'Storage cost'),
      ]).then(([storage, cost]) => {
        setData((prev) => ({
          ...prev,
          storageUtilization: storage.status === 'fulfilled' ? storage.value : prev.storageUtilization,
          costTracking: cost.status === 'fulfilled' ? cost.value : prev.costTracking,
        }));
        setSectionHealth((prev) => ({
          ...prev,
          storage:
            storage.status === 'fulfilled'
              ? { degraded: false, reason: '' }
              : { degraded: true, reason: 'storage_utilization_fetch_failed_or_timed_out' },
          cost:
            cost.status === 'fulfilled'
              ? { degraded: false, reason: '' }
              : { degraded: true, reason: 'storage_cost_fetch_failed_or_timed_out' },
        }));
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [retentionDays]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll, lastUpdatedAt, contractMeta, sectionHealth };
}
