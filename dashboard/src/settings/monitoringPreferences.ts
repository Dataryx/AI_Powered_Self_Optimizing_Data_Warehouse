/**
 * Monitoring / polling preferences for current session only.
 * Hooks listen for `dw-monitoring-preferences-changed` and refresh in-memory state.
 */

export const MONITORING_SETTINGS_STORAGE_KEY = 'dw-monitoring-settings';

/** Fired on `window` after save in this tab. */
export const MONITORING_PREFS_CHANGED_EVENT = 'dw-monitoring-preferences-changed';

export type MonitoringPreferences = {
  /** Seconds between home dashboard + monitoring panel refetches */
  dashboardRefreshSec: number;
  /** Seconds between alerts page bundle refetches */
  alertPollSec: number;
  /** Historical window (days): analytics long slice, growth trends, defaults elsewhere */
  retentionDays: number;
  /** Workload chart UTC bucket width (5/15/30 min → hourly; 6h / 24h coarser bins) */
  metricsAggregation: string;
};

const DEFAULTS: MonitoringPreferences = {
  dashboardRefreshSec: 30,
  alertPollSec: 60,
  retentionDays: 90,
  metricsAggregation: '1 hour',
};

const FIELD_LABELS = {
  dashboard: 'Dashboard refresh',
  alert: 'Alert check interval',
  retention: 'Data retention',
  aggregation: 'Metrics aggregation',
} as const;

type StoredRow = { label?: string; value?: string };
let SESSION_PREFS: MonitoringPreferences = { ...DEFAULTS };

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function parseSec(raw: string, fallback: number, min: number, max: number): number {
  const n = parseInt(String(raw).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
}

function parseDays(raw: string, fallback: number): number {
  return parseSec(raw, fallback, 1, 3650);
}

export function loadMonitoringPreferences(): MonitoringPreferences {
  return { ...SESSION_PREFS };
}

export function applyMonitoringPreferencesFromRows(rows: StoredRow[]): void {
  if (!Array.isArray(rows) || rows.length === 0) {
    SESSION_PREFS = { ...DEFAULTS };
    return;
  }

  const byLabel = new Map<string, string>();
  const first = rows[0];
  const looksLegacy =
    rows.length === 4 && first?.label === 'Dashboard Refresh Interval';
  if (looksLegacy) {
    const pick = (i: number, fall: string) =>
      typeof rows[i]?.value === 'string' ? String(rows[i]!.value) : fall;
    byLabel.set(FIELD_LABELS.dashboard, pick(0, String(DEFAULTS.dashboardRefreshSec)));
    byLabel.set(FIELD_LABELS.retention, pick(1, String(DEFAULTS.retentionDays)));
    byLabel.set(FIELD_LABELS.aggregation, pick(2, DEFAULTS.metricsAggregation));
    byLabel.set(FIELD_LABELS.alert, pick(3, String(DEFAULTS.alertPollSec)));
  }
  for (const row of rows) {
    if (row?.label && typeof row.value === 'string') {
      byLabel.set(row.label, row.value);
    }
  }

  const dash = byLabel.get(FIELD_LABELS.dashboard) ?? String(DEFAULTS.dashboardRefreshSec);
  const alert = byLabel.get(FIELD_LABELS.alert) ?? String(DEFAULTS.alertPollSec);
  const ret = byLabel.get(FIELD_LABELS.retention) ?? String(DEFAULTS.retentionDays);
  const agg = byLabel.get(FIELD_LABELS.aggregation) ?? DEFAULTS.metricsAggregation;

  SESSION_PREFS = {
    dashboardRefreshSec: parseSec(dash, DEFAULTS.dashboardRefreshSec, 5, 600),
    alertPollSec: parseSec(alert, DEFAULTS.alertPollSec, 10, 3600),
    retentionDays: parseDays(ret, DEFAULTS.retentionDays),
    metricsAggregation: agg || DEFAULTS.metricsAggregation,
  };
}

export function secondsToMs(sec: number): number {
  return clamp(sec, 1, 86400) * 1000;
}

export function notifyMonitoringPreferencesChanged(): void {
  window.dispatchEvent(new Event(MONITORING_PREFS_CHANGED_EVENT));
}

/** Maps data-retention preference to storage growth-trend API window (7 / 30 / 90 days). */
export function growthTrendDaysFromRetention(retentionDays: number): 7 | 30 | 90 {
  const n = Number(retentionDays);
  const d = Math.max(1, Math.min(3650, Number.isFinite(n) ? Math.round(n) : 90));
  if (d <= 15) return 7;
  if (d <= 50) return 30;
  return 90;
}

export { DEFAULTS as MONITORING_PREFERENCES_DEFAULTS, FIELD_LABELS as MONITORING_FIELD_LABELS };
