import { useState, useEffect } from 'react';
import {
  loadMonitoringPreferences,
  MONITORING_PREFS_CHANGED_EVENT,
  secondsToMs,
} from '../settings/monitoringPreferences';

function subscribePrefs(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === 'dw-monitoring-settings') cb();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(MONITORING_PREFS_CHANGED_EVENT, cb);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(MONITORING_PREFS_CHANGED_EVENT, cb);
  };
}

/** Refetch interval for Monitoring page + home dashboard (ms). */
export function useDashboardRefreshIntervalMs(): number {
  const [ms, setMs] = useState(() => secondsToMs(loadMonitoringPreferences().dashboardRefreshSec));
  useEffect(() => {
    const sync = () => setMs(secondsToMs(loadMonitoringPreferences().dashboardRefreshSec));
    sync();
    return subscribePrefs(sync);
  }, []);
  return ms;
}

/** Refetch interval for Alerts page bundle (ms). */
export function useAlertPollIntervalMs(): number {
  const [ms, setMs] = useState(() => secondsToMs(loadMonitoringPreferences().alertPollSec));
  useEffect(() => {
    const sync = () => setMs(secondsToMs(loadMonitoringPreferences().alertPollSec));
    sync();
    return subscribePrefs(sync);
  }, []);
  return ms;
}

/** Historical window (days) for analytics long slice, storage defaults, etc. */
export function useRetentionDays(): number {
  const [days, setDays] = useState(() => loadMonitoringPreferences().retentionDays);
  useEffect(() => {
    const sync = () => setDays(loadMonitoringPreferences().retentionDays);
    sync();
    return subscribePrefs(sync);
  }, []);
  return days;
}

/** Chart rollup from Monitoring settings (workload bucketing). */
export function useMetricsAggregation(): string {
  const [label, setLabel] = useState(() => loadMonitoringPreferences().metricsAggregation);
  useEffect(() => {
    const sync = () => setLabel(loadMonitoringPreferences().metricsAggregation);
    sync();
    return subscribePrefs(sync);
  }, []);
  return label;
}
