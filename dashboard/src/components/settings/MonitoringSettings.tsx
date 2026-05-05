import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Save, Gauge, Timer, Archive, BarChart2, BellRing, RotateCcw } from 'lucide-react';
import {
  MONITORING_FIELD_LABELS as L,
  MONITORING_PREFERENCES_DEFAULTS as D,
  applyMonitoringPreferencesFromRows,
  notifyMonitoringPreferencesChanged,
} from '../../settings/monitoringPreferences';

interface MonField {
  label: string;
  description: string;
  value: string;
  unit: string;
  type: 'input' | 'select';
  options?: string[];
  group: 'polling' | 'lifecycle';
  icon: typeof Timer;
  min?: number;
  max?: number;
}

const initialFields: MonField[] = [
  {
    label: L.dashboard,
    description: 'How often the home dashboard and Monitoring page refetch data from the API.',
    value: String(D.dashboardRefreshSec),
    unit: 'sec',
    type: 'input',
    group: 'polling',
    icon: Timer,
    min: 5,
    max: 600,
  },
  {
    label: L.alert,
    description: 'How often the Alerts page refreshes its bundle in the background.',
    value: String(D.alertPollSec),
    unit: 'sec',
    type: 'input',
    group: 'polling',
    icon: BellRing,
    min: 10,
    max: 3600,
  },
  {
    label: L.retention,
    description:
      'Analytics long query window, Optimizations default range, home sales chart default, and storage growth tab mapping.',
    value: String(D.retentionDays),
    unit: 'days',
    type: 'input',
    group: 'lifecycle',
    icon: Archive,
    min: 1,
    max: 3650,
  },
  {
    label: L.aggregation,
    description: 'Analytics workload chart: UTC run counts rolled up to this bucket width (hourly source → wider bins).',
    value: D.metricsAggregation,
    unit: '',
    type: 'select',
    options: ['5 minutes', '15 minutes', '30 minutes', '1 hour', '6 hours', '24 hours'],
    group: 'lifecycle',
    icon: BarChart2,
  },
];

const GROUP_META: Record<MonField['group'], { title: string; blurb: string }> = {
  polling: {
    title: 'Refresh cadence',
    blurb: 'Lower values feel more live; higher values reduce API load.',
  },
  lifecycle: {
    title: 'Windows & rollup',
    blurb: 'How you think about history when exploring trends.',
  },
};

const REFRESH_PRESETS = [15, 30, 60, 120] as const;

export default function MonitoringSettings() {
  const [fields, setFields] = useState<MonField[]>(() => initialFields);
  const [saved, setSaved] = useState<'idle' | 'ok' | 'error'>('idle');

  const byGroup = useMemo(() => {
    const polling = fields.filter((f) => f.group === 'polling');
    const lifecycle = fields.filter((f) => f.group === 'lifecycle');
    return { polling, lifecycle };
  }, [fields]);

  const updateField = (idx: number, val: string) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, value: val } : f)));
    setSaved('idle');
  };

  const applyDashboardPreset = (sec: number) => {
    const idx = fields.findIndex((f) => f.label === L.dashboard);
    if (idx >= 0) updateField(idx, String(sec));
  };

  const resetDefaults = () => {
    setFields(initialFields);
    setSaved('idle');
  };

  const handleSave = () => {
    applyMonitoringPreferencesFromRows(fields.map((f) => ({ label: f.label, value: f.value })));
    notifyMonitoringPreferencesChanged();
    setSaved('ok');
    setTimeout(() => setSaved('idle'), 2500);
  };

  const renderField = (field: MonField, i: number, globalIdx: number) => {
    const Icon = field.icon;
    const clampHint =
      field.type === 'input' && field.min != null && field.max != null
        ? `${field.min}–${field.max} ${field.unit}`
        : null;

    return (
      <motion.div
        key={field.label}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.04 + 0.08 }}
        className="rounded-lg border border-[#1e2540] bg-[#0a0e14] p-3 sm:p-4 hover:border-[#2a3555] transition-colors"
      >
        <div className="flex items-start gap-2.5 mb-2.5">
          <div className="w-9 h-9 rounded-md bg-[#12182a] border border-[#2a3555] flex items-center justify-center shrink-0">
            <Icon size={16} className="text-[#8a9aaa]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-body text-sm font-semibold text-[#e0e8f5] block">{field.label}</span>
            <p className="font-body text-xs text-[#8a9aaa] mt-1 leading-relaxed">{field.description}</p>
            {clampHint ? (
              <p className="font-mono text-[10px] text-[#5a6a8a] mt-1">Allowed: {clampHint}</p>
            ) : null}
          </div>
        </div>
        {field.label === L.dashboard ? (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {REFRESH_PRESETS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => applyDashboardPreset(sec)}
                className="px-2 py-1 rounded-md text-[10px] font-mono border border-[#2a3555] bg-[#0c0f1a] text-[#8a9aaa] hover:text-[#c0cde0] hover:border-[#3a4a62] transition-colors"
              >
                {sec}s
              </button>
            ))}
          </div>
        ) : null}
        {field.type === 'input' ? (
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={field.value}
              onChange={(e) => updateField(globalIdx, e.target.value.replace(/[^\d.]/g, ''))}
              className="w-full bg-[#12182a] border border-[#2a3555] rounded-md px-3 py-2.5 font-mono text-sm text-[#c0cde0] focus:outline-none focus:border-[#3ecfff40] focus:ring-1 focus:ring-[#3ecfff25] transition-all pr-14"
              aria-label={field.label}
            />
            {field.unit ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[#5a6a8a] tracking-wider pointer-events-none">
                {field.unit}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="relative">
            <select
              value={field.value}
              onChange={(e) => updateField(globalIdx, e.target.value)}
              className="w-full bg-[#12182a] border border-[#2a3555] rounded-md px-3 py-2.5 font-mono text-sm text-[#c0cde0] focus:outline-none focus:border-[#3ecfff40] focus:ring-1 focus:ring-[#3ecfff25] transition-all appearance-none cursor-pointer pr-10"
              aria-label={field.label}
            >
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6a8a] pointer-events-none"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              aria-hidden
            >
              <path
                d="M3 5l3 3 3-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 }}
      className="rounded-lg border border-[#1e2540] bg-[#0c0f1a] overflow-hidden"
    >
      <div className="px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-[#1e2540]">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-md bg-[#3ecfff12] border border-[#3ecfff25] flex items-center justify-center shrink-0">
            <Gauge size={18} className="text-[#3ecfff]" aria-hidden />
          </div>
          <div>
            <h2 className="font-body text-base font-semibold text-[#e0e8f5] tracking-tight">Monitoring &amp; polling</h2>
            <p className="font-body text-xs text-[#8a9aaa] mt-1 max-w-xl leading-relaxed">
              Applied for the current session only. Changes are not persisted in local browser storage.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-[#2a3555] bg-[#12182a] text-[#c0cde0] hover:border-[#3a4a62] font-mono text-[11px] tracking-wide transition-colors"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-[#3ecfff35] bg-[#1a2235] text-[#e0e8f5] font-mono text-[11px] font-semibold tracking-wide hover:bg-[#243050] transition-colors"
          >
            <Save size={14} />
            {saved === 'ok' ? 'Saved ✓' : saved === 'error' ? 'Failed' : 'Apply'}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-6">
        {(['polling', 'lifecycle'] as const).map((groupKey) => {
          const list = byGroup[groupKey];
          const meta = GROUP_META[groupKey];
          return (
            <div key={groupKey}>
              <h3 className="font-mono text-[10px] font-bold tracking-[0.18em] text-[#5a6a8a] uppercase">{meta.title}</h3>
              <p className="font-body text-xs text-[#6b7a94] mt-1 mb-3">{meta.blurb}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {list.map((field, i) => {
                  const globalIdx = fields.findIndex((f) => f.label === field.label);
                  return renderField(field, i, globalIdx >= 0 ? globalIdx : i);
                })}
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
