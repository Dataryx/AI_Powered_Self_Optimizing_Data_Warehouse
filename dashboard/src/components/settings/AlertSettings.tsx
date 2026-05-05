import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bell, AlertTriangle, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { SettingsSwitch } from './SettingsSwitch';
import { api } from '../../services/api';

export type AlertRuleRow = {
  alert_type: string;
  title: string;
  enabled: boolean;
  severity: string;
  threshold: number;
  description: string;
  /** Show numeric threshold editor */
  hasThreshold: boolean;
  thresholdSuffix: string;
};

const RULE_DEFS: Omit<AlertRuleRow, 'enabled' | 'threshold'>[] = [
  {
    alert_type: 'slow_query',
    title: 'Slow queries',
    severity: 'high',
    description: 'Flag rows in query_logs whose mean execution time exceeds the limit.',
    hasThreshold: true,
    thresholdSuffix: 'seconds',
  },
  {
    alert_type: 'performance',
    title: 'Cache hit rate',
    severity: 'low',
    description: 'Tables with heap cache hit rate below this percent are flagged.',
    hasThreshold: true,
    thresholdSuffix: '% min hit rate',
  },
  {
    alert_type: 'data_quality',
    title: 'Dead tuples',
    severity: 'medium',
    description: 'Tables whose dead-tuple ratio exceeds this percent trigger an alert.',
    hasThreshold: true,
    thresholdSuffix: '% max dead ratio',
  },
  {
    alert_type: 'empty_table',
    title: 'Empty tables',
    severity: 'warning',
    description: 'Medallion tables with zero live rows.',
    hasThreshold: false,
    thresholdSuffix: '',
  },
  {
    alert_type: 'storage',
    title: 'Large tables',
    severity: 'info',
    description: 'Tables larger than this size (GB) are highlighted.',
    hasThreshold: true,
    thresholdSuffix: 'GB',
  },
  {
    alert_type: 'etl_failure',
    title: 'ETL failures',
    severity: 'high',
    description: 'Failed or error runs from monitoring.job_runs.',
    hasThreshold: false,
    thresholdSuffix: '',
  },
  {
    alert_type: 'model_anomaly',
    title: 'ML query anomalies',
    severity: 'medium',
    description: 'IsolationForest signals on recent query_logs (if model is present).',
    hasThreshold: false,
    thresholdSuffix: '',
  },
];

const DEFAULT_THR: Record<string, number> = {
  slow_query: 5,
  performance: 70,
  data_quality: 10,
  empty_table: 0,
  storage: 5,
  etl_failure: 0,
  model_anomaly: 0,
};

function defaultRows(): AlertRuleRow[] {
  return RULE_DEFS.map((d) => ({
    ...d,
    enabled: true,
    threshold: DEFAULT_THR[d.alert_type] ?? 0,
  }));
}

function mergeFromApi(
  apiList: Array<{
    alert_type: string;
    enabled?: boolean;
    severity?: string;
    threshold?: number;
    description?: string;
  }>,
): AlertRuleRow[] {
  const byType = new Map(apiList.map((c) => [c.alert_type, c]));
  return RULE_DEFS.map((def) => {
    const hit = byType.get(def.alert_type);
    return {
      ...def,
      enabled: hit?.enabled ?? true,
      severity: hit?.severity ?? def.severity,
      threshold: typeof hit?.threshold === 'number' ? hit.threshold : DEFAULT_THR[def.alert_type] ?? 0,
      description: hit?.description ?? def.description,
    };
  });
}

function rowsToPayload(rows: AlertRuleRow[]) {
  return rows.map((r) => ({
    alert_type: r.alert_type,
    enabled: r.enabled,
    severity: r.severity,
    threshold: r.hasThreshold ? r.threshold : 0,
  }));
}

const severityStripe: Record<string, string> = {
  high: 'bg-red-500/55',
  medium: 'bg-[#8a7a50]',
  low: 'bg-[#3a4a62]',
  warning: 'bg-[#5a6a8a]',
  info: 'bg-[#3a4a62]',
  critical: 'bg-red-500/70',
};

const severityBadge: Record<string, string> = {
  high: 'bg-[#12182a] text-[#c0cde0] border-[#2a3555]',
  medium: 'bg-[#12182a] text-[#8a9aaa] border-[#2a3555]',
  low: 'bg-[#12182a] text-[#8a9aaa] border-[#2a3555]',
  warning: 'bg-[#12182a] text-[#8a9aaa] border-[#2a3555]',
  info: 'bg-[#12182a] text-[#8a9aaa] border-[#2a3555]',
  critical: 'bg-red-500/[0.08] text-red-200/90 border-red-500/22',
};

export default function AlertSettings() {
  const [rows, setRows] = useState<AlertRuleRow[]>(() => defaultRows());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.getAlertConfig();
      const list = res.configs ?? [];
      if (list.length > 0) {
        setRows(mergeFromApi(list));
      } else {
        setRows(defaultRows());
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not reach API';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (idx: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, enabled: !r.enabled } : r)));
    setSavedOk(false);
    setSaveHint(null);
  };

  const setThreshold = (idx: number, raw: string) => {
    const n = parseFloat(raw.replace(/[^\d.-]/g, ''));
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, threshold: Number.isFinite(n) ? n : r.threshold } : r)),
    );
    setSavedOk(false);
    setSaveHint(null);
  };

  const save = async () => {
    setSaving(true);
    setSaveHint(null);
    setSavedOk(false);
    try {
      await api.updateAlertConfigs(rowsToPayload(rows));
      setSavedOk(true);
      setSaveHint('Applied on the API process — active alerts use these rules immediately.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      setSaveHint(`${msg} · Rules were not updated on the server.`);
    } finally {
      setSaving(false);
      setTimeout(() => setSavedOk(false), 2800);
    }
  };

  const enabledCount = rows.filter((r) => r.enabled).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 }}
      className="rounded-lg border border-[#1e2540] bg-[#0c0f1a] overflow-hidden flex flex-col min-h-[320px]"
    >
      <div className="px-4 py-3 sm:px-5 sm:py-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 border-b border-[#1e2540]">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-md bg-[#3ecfff12] border border-[#3ecfff25] flex items-center justify-center shrink-0">
            <Bell size={18} className="text-[#3ecfff]" aria-hidden />
          </div>
          <div>
            <h2 className="font-body text-base font-semibold text-[#e0e8f5] tracking-tight">Alert rules</h2>
            <p className="font-body text-xs text-[#8a9aaa] mt-1 max-w-xl leading-relaxed">
              Thresholds and toggles are stored in the ML API process (in-memory until restart). They directly change how
              active alerts are built.
            </p>
            <p className="font-mono text-[10px] text-[#5a6a8a] mt-1.5">
              <span className="text-[#c0cde0] font-bold tabular-nums">{enabledCount}</span>
              <span> / {rows.length} rules on</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-[#2a3555] bg-[#12182a] text-[#c0cde0] hover:border-[#3a4a62] font-mono text-[11px] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Reload
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-[#3ecfff35] bg-[#1a2235] text-[#e0e8f5] font-mono text-[11px] font-semibold tracking-wide hover:bg-[#243050] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {savedOk ? 'Saved ✓' : 'Save to API'}
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="mx-4 sm:mx-5 mt-3 flex items-start gap-2 rounded-md border border-[#4a3828] bg-[#2a2018] px-3 py-2 text-[#c4b4a0] text-xs font-mono">
          <CloudOff size={16} className="shrink-0 mt-0.5 opacity-80" />
          <span>
            {loadError} — showing default rules only. Fix the API URL or start the backend, then Reload.
          </span>
        </div>
      ) : null}

      {saveHint ? (
        <div
          className={`mx-4 sm:mx-5 mt-2 rounded-md border px-3 py-2 text-xs font-mono ${
            saveHint.startsWith('Applied')
              ? 'border-[#1a4a38] bg-[#0d3a2a]/40 text-[#6ee7b7]/90'
              : 'border-red-500/25 bg-red-500/10 text-red-300'
          }`}
        >
          {saveHint}
        </div>
      ) : null}

      <div className="p-4 sm:p-5 flex-1 overflow-y-auto max-h-[min(68vh,560px)] space-y-2.5 [scrollbar-gutter:stable]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-[#5a6a8a]">
            <Loader2 size={26} className="animate-spin text-[#3ecfff]" />
            <span className="font-mono text-sm">Loading rules from API…</span>
          </div>
        ) : (
          rows.map((rule, i) => (
            <motion.div
              key={rule.alert_type}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.2) }}
              className={`relative rounded-lg border overflow-hidden transition-colors ${
                rule.enabled ? 'border-[#1e2540] bg-[#0a0e14]' : 'border-[#1e2540]/60 bg-[#080c12] opacity-80'
              }`}
            >
              <div
                className={`absolute left-0 top-0 bottom-0 w-0.5 ${severityStripe[rule.severity] ?? 'bg-[#3a4a62]'}`}
                aria-hidden
              />
              <div className="pl-3 pr-3 py-3 sm:py-3.5">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertTriangle size={14} className="text-[#5a6a8a] shrink-0 mt-0.5" aria-hidden />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-body text-sm font-semibold text-[#e0e8f5]">{rule.title}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded border font-mono text-[8px] font-bold tracking-widest uppercase ${
                            severityBadge[rule.severity] ?? severityBadge.medium
                          }`}
                        >
                          {rule.severity}
                        </span>
                        <span className="font-mono text-[9px] text-[#5a6a8a]">{rule.alert_type}</span>
                      </div>
                      <p className="font-body text-xs text-[#8a9aaa] mt-1 leading-relaxed">{rule.description}</p>
                    </div>
                  </div>
                  <SettingsSwitch
                    enabled={rule.enabled}
                    onChange={() => toggle(i)}
                    aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.title}`}
                    className="self-start sm:self-center"
                  />
                </div>
                {rule.hasThreshold ? (
                  <div className="mt-2.5 sm:pl-6">
                    <label className="font-mono text-[9px] text-[#5a6a8a] tracking-[0.12em] uppercase block mb-1">
                      Threshold · {rule.thresholdSuffix}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={String(rule.threshold)}
                      onChange={(e) => setThreshold(i, e.target.value)}
                      disabled={!rule.enabled}
                      className="w-full sm:max-w-[220px] bg-[#12182a] border border-[#2a3555] rounded-md px-3 py-2 font-mono text-sm text-[#c0cde0] focus:outline-none focus:border-[#3ecfff40] focus:ring-1 focus:ring-[#3ecfff25] disabled:opacity-45"
                    />
                  </div>
                ) : null}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.section>
  );
}
