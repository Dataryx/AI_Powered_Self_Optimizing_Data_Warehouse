/**
 * ETL Monitoring page only.
 * Prefers GET /monitoring/etl/monitoring-page (one browser request).
 * Falls back to dashboard-bundle + freshness + data-quality, then legacy 7 calls.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useDashboardRefreshIntervalMs } from './useMonitoringPreferences';

type MonitoringSlice = {
  jobs?: any[];
  jobDefinitions?: any[];
  pipeline?: any;
  freshness?: any;
  errors?: any[];
  dataQuality?: any;
  throughput?: any;
  /** From monitoring bundle: COUNT(*) failed/error job_runs (all time). */
  failedRunsTotal?: number;
  /** From GET /alerts/anomalies (`total`); matches Alerts ML/heuristic anomaly list. */
  mlAnomalyCount?: number;
};

function isApiNotFound(e: unknown): boolean {
  return /\b404\b|Not Found/i.test(e instanceof Error ? e.message : String(e));
}

/** Parse GET /alerts/anomalies payload for display on ETL Monitoring stats row. */
function parseAnomaliesTotal(raw: unknown): number | undefined {
  if (raw == null || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const t = o.total;
  if (typeof t === 'number' && Number.isFinite(t)) return Math.max(0, Math.floor(t));
  const arr = o.anomalies;
  if (Array.isArray(arr)) return Math.max(0, arr.length);
  return undefined;
}

/** Σ failed/error job_runs from monitoring bundle — never infer from errors[] (diagnostics mixed in). */
function pickFailedRunsTotal(payload: unknown): number | undefined {
  if (payload == null || typeof payload !== 'object') return undefined;
  const o = payload as Record<string, unknown>;
  const raw = o.failedRunsTotal ?? o.failed_runs_total;
  if (raw === '' || raw == null) return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.floor(n));
}

export function useMonitoringData() {
  const pollIntervalMs = useDashboardRefreshIntervalMs();
  const [data, setData] = useState<MonitoringSlice>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const fetchAll = useCallback(async (options?: { silent?: boolean; bustCache?: boolean }) => {
    const myId = ++genRef.current;
    const bust = options?.bustCache ?? false;

    const merge = (patch: MonitoringSlice) => {
      if (genRef.current !== myId) return;
      setData((prev) => ({ ...prev, ...patch }));
    };

    if (options?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setError(null);
    }

    const legacyParallel = () =>
      Promise.allSettled([
        api
          .getETLJobs()
          .then((v) => merge({ jobs: Array.isArray(v) ? v : v?.jobs ?? [] }))
          .catch(() => merge({ jobs: [] })),
        api
          .getETLJobDefinitions()
          .then((v) => {
            const jobs = (v as any)?.jobs;
            merge({ jobDefinitions: Array.isArray(jobs) ? jobs : [] });
          })
          .catch(() => merge({ jobDefinitions: [] })),
        api.getPipelineDAG().then((v) => merge({ pipeline: v })).catch(() => {}),
        api.getDataFreshness(bust).then((v) => merge({ freshness: v })).catch(() => {}),
        api
          .getETLErrors()
          .then((v) => {
            const payload = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
            const errs = Array.isArray(v) ? v : (payload.errors as unknown[] | undefined) ?? [];
            const fr = pickFailedRunsTotal(payload);
            merge({
              errors: errs as any[],
              ...(fr !== undefined ? { failedRunsTotal: fr } : {}),
            });
          })
          .catch(() => merge({ errors: [] })),
        api.getDataQualityMetrics(bust).then((v) => merge({ dataQuality: v })).catch(() => {}),
        api.getThroughputMetrics().then((v) => merge({ throughput: v })).catch(() => {}),
      ]);

    try {
      const [pageResult, anomaliesResult] = await Promise.allSettled([
        api.getETLMonitoringPage(bust),
        api.getAnomalies(),
      ]);

      if (anomaliesResult.status === 'fulfilled') {
        const n = parseAnomaliesTotal(anomaliesResult.value);
        merge({ mlAnomalyCount: n });
      } else {
        merge({ mlAnomalyCount: undefined });
      }

      if (pageResult.status === 'fulfilled') {
        const page = pageResult.value;
        merge({
          jobs: (page.jobs ?? []) as any[],
          jobDefinitions: (page.jobDefinitions ?? []) as any[],
          pipeline: page.pipeline,
          errors: (page.errors ?? []) as any[],
          throughput: page.throughput ?? undefined,
          freshness: page.freshness,
          dataQuality: page.dataQuality,
          failedRunsTotal: pickFailedRunsTotal(page as Record<string, unknown>),
        });
        if (!options?.silent) {
          setLoading(false);
        }
      } else if (!isApiNotFound(pageResult.reason)) {
        throw pageResult.reason instanceof Error ? pageResult.reason : new Error(String(pageResult.reason));
      } else {
        try {
          const bundle = await api.getETLMonitoringDashboardBundle(bust);
          merge({
            jobs: bundle.jobs ?? [],
            jobDefinitions: (bundle.jobDefinitions ?? []) as any[],
            pipeline: bundle.pipeline,
            errors: (bundle.errors ?? []) as any[],
            throughput: bundle.throughput ?? undefined,
            failedRunsTotal: pickFailedRunsTotal(bundle as Record<string, unknown>),
          });
          if (!options?.silent) {
            setLoading(false);
          }
          await Promise.allSettled([
            api
              .getDataFreshness(bust)
              .then((v) => merge({ freshness: v }))
              .catch(() =>
                merge({
                  freshness: {
                    datasets: [],
                    freshness: {},
                    on_time: 0,
                    at_risk: 0,
                    sla_breach: 0,
                    unknown_datasets: 0,
                    total_datasets: 0,
                  },
                })
              ),
            api
              .getDataQualityMetrics(bust)
              .then((v) => merge({ dataQuality: v }))
              .catch(() => merge({ dataQuality: { layers: [], quality_metrics: {} } })),
          ]);
        } catch (e2) {
          if (!isApiNotFound(e2)) {
            throw e2;
          }
          await legacyParallel();
        }
      }
    } catch (e: any) {
      if (genRef.current === myId) {
        setError(e?.message ?? 'Failed to load monitoring data');
      }
    } finally {
      if (genRef.current !== myId) {
        return;
      }
      if (!options?.silent) {
        setLoading(false);
      }
      if (options?.silent) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    const id = setInterval(() => {
      void fetchAll({ silent: true });
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [fetchAll, pollIntervalMs]);

  return {
    data,
    loading,
    refreshing,
    error,
    refetch: () => void fetchAll({ bustCache: true }),
  };
}
