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
};

function isApiNotFound(e: unknown): boolean {
  return /\b404\b|Not Found/i.test(e instanceof Error ? e.message : String(e));
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
          .then((v) => merge({ errors: Array.isArray(v) ? v : v?.errors ?? [] }))
          .catch(() => merge({ errors: [] })),
        api.getDataQualityMetrics(bust).then((v) => merge({ dataQuality: v })).catch(() => {}),
        api.getThroughputMetrics().then((v) => merge({ throughput: v })).catch(() => {}),
      ]);

    try {
      try {
        const page = await api.getETLMonitoringPage(bust);
        merge({
          jobs: (page.jobs ?? []) as any[],
          jobDefinitions: (page.jobDefinitions ?? []) as any[],
          pipeline: page.pipeline,
          errors: (page.errors ?? []) as any[],
          throughput: page.throughput ?? undefined,
          freshness: page.freshness,
          dataQuality: page.dataQuality,
        });
        if (!options?.silent) {
          setLoading(false);
        }
      } catch (e) {
        if (!isApiNotFound(e)) {
          throw e;
        }
        try {
          const bundle = await api.getETLMonitoringDashboardBundle(bust);
          merge({
            jobs: bundle.jobs ?? [],
            jobDefinitions: (bundle.jobDefinitions ?? []) as any[],
            pipeline: bundle.pipeline,
            errors: (bundle.errors ?? []) as any[],
            throughput: bundle.throughput ?? undefined,
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
