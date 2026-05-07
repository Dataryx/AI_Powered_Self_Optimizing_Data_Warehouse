import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../services/api';
import { useAlertPollIntervalMs } from './useMonitoringPreferences';

function isApiNotFound(e: unknown): boolean {
  return /\b404\b|Not Found/i.test(e instanceof Error ? e.message : String(e));
}

/** Use split /alerts/* calls when bundle is missing (404) or server errors (so inbox/anomalies can still load). */
function shouldFallbackFromBundleError(e: unknown): boolean {
  if (isApiNotFound(e)) return true;
  if (e instanceof ApiError && (e.status >= 500 || e.status === 408 || e.status === 502 || e.status === 503)) {
    return true;
  }
  return false;
}

export type AlertsPageMeta = {
  active?: { total?: number; by_severity?: Record<string, number> };
  anomalies?: { total?: number; by_type?: Record<string, number> };
  incidents?: { total?: number; open?: number; resolved?: number };
};

export function useAlertsData() {
  const pollIntervalMs = useAlertPollIntervalMs();
  const [data, setData] = useState<{
    alerts?: any[];
    anomalies?: any[];
    incidents?: any[];
    meta?: AlertsPageMeta;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      try {
        const b = await api.getAlertsPageBundle();
        const active = b.active as
          | { alerts?: any[]; total?: number; by_severity?: Record<string, number> }
          | undefined;
        const anom = b.anomalies as
          | { anomalies?: any[]; total?: number; by_type?: Record<string, number> }
          | undefined;
        const inc = b.incidents as
          | { incidents?: any[]; total?: number; open?: number; resolved?: number }
          | undefined;
        setData({
          alerts: Array.isArray(active?.alerts) ? active!.alerts : [],
          anomalies: Array.isArray(anom?.anomalies) ? anom!.anomalies : [],
          incidents: Array.isArray(inc?.incidents) ? inc!.incidents : [],
          meta: {
            active: { total: active?.total, by_severity: active?.by_severity },
            anomalies: { total: anom?.total, by_type: anom?.by_type },
            incidents: { total: inc?.total, open: inc?.open, resolved: inc?.resolved },
          },
        });
        setLastUpdatedAt(Date.now());
      } catch (e) {
        if (!shouldFallbackFromBundleError(e)) {
          throw e;
        }
        const [alerts, anomalies, incidents] = await Promise.allSettled([
          api.getActiveAlerts(),
          api.getAnomalies(),
          api.getIncidents(),
        ]);
        const alertsList = alerts.status === 'fulfilled' ? ((alerts.value as any)?.alerts ?? []) : [];
        const anomaliesList =
          anomalies.status === 'fulfilled'
            ? Array.isArray(anomalies.value)
              ? anomalies.value
              : (anomalies.value as any)?.anomalies ?? []
            : [];
        const incidentsList =
          incidents.status === 'fulfilled'
            ? Array.isArray(incidents.value)
              ? incidents.value
              : (incidents.value as any)?.incidents ?? []
            : [];
        setData({
          alerts: alertsList,
          anomalies: anomaliesList,
          incidents: incidentsList,
          meta: {
            active: {
              total: alertsList.length,
              by_severity: ['critical', 'high', 'medium', 'low', 'info'].reduce(
                (acc, s) => {
                  acc[s] = alertsList.filter((a: { severity?: string }) => a?.severity === s).length;
                  return acc;
                },
                {} as Record<string, number>,
              ),
            },
            anomalies: { total: anomaliesList.length },
            incidents: {
              total: incidentsList.length,
              open: incidentsList.filter((i: { status?: string }) => i?.status === 'open').length,
              resolved: incidentsList.filter((i: { status?: string }) => i?.status === 'resolved')
                .length,
            },
          },
        });
        setLastUpdatedAt(Date.now());
      }
    } catch (e: any) {
      if (!opts?.silent) {
        setError(e?.message ?? 'Failed to load alerts');
      }
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (pollIntervalMs <= 0) return;
    const id = setInterval(() => {
      void fetchAll({ silent: true });
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [fetchAll, pollIntervalMs]);

  return { data, loading, error, refetch: () => void fetchAll(), lastUpdatedAt };
}
