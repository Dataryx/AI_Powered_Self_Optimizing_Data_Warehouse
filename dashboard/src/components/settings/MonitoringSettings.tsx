import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Save, Gauge, Timer, Archive, BarChart2, BellRing } from 'lucide-react';

interface MonField {
  label: string;
  description: string;
  value: string;
  unit: string;
  type: 'input' | 'select';
  options?: string[];
  group: 'polling' | 'lifecycle';
  icon: typeof Timer;
}

const initialFields: MonField[] = [
  {
    label: 'Dashboard refresh',
    description: 'How often dashboard panels refetch data',
    value: '30',
    unit: 'sec',
    type: 'input',
    group: 'polling',
    icon: Timer,
  },
  {
    label: 'Alert check interval',
    description: 'How often to poll for new alert conditions',
    value: '60',
    unit: 'sec',
    type: 'input',
    group: 'polling',
    icon: BellRing,
  },
  {
    label: 'Data retention',
    description: 'Retention window for historical metrics in UI',
    value: '90',
    unit: 'days',
    type: 'input',
    group: 'lifecycle',
    icon: Archive,
  },
  {
    label: 'Metrics aggregation',
    description: 'Rollup granularity for charts and summaries',
    value: '1 hour',
    unit: '',
    type: 'select',
    options: ['5 minutes', '15 minutes', '30 minutes', '1 hour', '6 hours', '24 hours'],
    group: 'lifecycle',
    icon: BarChart2,
  },
];

const STORAGE_KEY = 'dw-monitoring-settings';

const GROUP_META: Record<MonField['group'], { title: string; blurb: string }> = {
  polling: { title: 'Polling & checks', blurb: 'Controls how often the UI and alert logic wake up.' },
  lifecycle: { title: 'Data lifecycle', blurb: 'How long data is considered relevant and how it is rolled up.' },
};

const LEGACY_FIELD_ORDER = [
  'Dashboard Refresh Interval',
  'Data Retention',
  'Metrics Aggregation Interval',
  'Alert Check Interval',
] as const;

function migrateStoredFields(parsed: unknown): MonField[] {
  if (!Array.isArray(parsed)) return initialFields;

  const first = parsed[0] as { label?: string } | undefined;
  const looksLegacy =
    parsed.length === 4 && first?.label === LEGACY_FIELD_ORDER[0];

  if (looksLegacy) {
    const v = parsed as { value?: string }[];
    const pick = (i: number, fallback: string) =>
      typeof v[i]?.value === 'string' ? String(v[i].value) : fallback;
    return [
      { ...initialFields[0], value: pick(0, initialFields[0].value) },
      { ...initialFields[1], value: pick(3, initialFields[1].value) },
      { ...initialFields[2], value: pick(1, initialFields[2].value) },
      { ...initialFields[3], value: pick(2, initialFields[3].value) },
    ];
  }

  return initialFields.map((init) => {
    const hit = parsed.find((p: { label?: string }) => p?.label === init.label);
    if (hit && typeof hit === 'object' && 'value' in hit && typeof (hit as { value: string }).value === 'string') {
      return { ...init, value: (hit as { value: string }).value };
    }
    const idx = initialFields.indexOf(init);
    const byIndex = parsed[idx] as { value?: string } | undefined;
    if (byIndex && typeof byIndex.value === 'string') {
      return { ...init, value: byIndex.value };
    }
    return init;
  });
}

export default function MonitoringSettings() {
  const [fields, setFields] = useState<MonField[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrateStoredFields(JSON.parse(raw));
    } catch (_) {
      /* ignore */
    }
    return initialFields;
  });
  const [saved, setSaved] = useState(false);

  const byGroup = useMemo(() => {
    const polling = fields.filter((f) => f.group === 'polling');
    const lifecycle = fields.filter((f) => f.group === 'lifecycle');
    return { polling, lifecycle };
  }, [fields]);

  const updateField = (idx: number, val: string) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, value: val } : f)));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const renderField = (field: MonField, i: number, globalIdx: number) => {
    const Icon = field.icon;
    return (
      <motion.div
        key={field.label}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 + 0.12 }}
        className="rounded-xl border border-contour-strong bg-base/50 p-4 hover:border-topo-5/20 transition-colors"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-topo-5/10 border border-topo-5/20 flex items-center justify-center shrink-0">
            <Icon size={16} className="text-topo-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-body text-sm font-semibold text-ink block">{field.label}</span>
            {field.description ? (
              <p className="font-mono text-[10px] text-ink-muted mt-0.5 leading-relaxed">{field.description}</p>
            ) : null}
          </div>
        </div>
        {field.type === 'input' ? (
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={field.value}
              onChange={(e) => updateField(globalIdx, e.target.value)}
              className="w-full bg-surface border border-contour-strong rounded-lg px-3 py-2.5 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-topo-5/25 focus:border-topo-5/40 transition-all pr-14"
            />
            {field.unit ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-ink-faint tracking-wider pointer-events-none">
                {field.unit}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="relative">
            <select
              value={field.value}
              onChange={(e) => updateField(globalIdx, e.target.value)}
              className="w-full bg-surface border border-contour-strong rounded-lg px-3 py-2.5 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-topo-5/25 focus:border-topo-5/40 transition-all appearance-none cursor-pointer pr-10"
            >
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="relative bg-surface rounded-2xl border border-contour-strong overflow-hidden h-fit"
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-80"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(62,207,255,0.7), rgba(129,140,248,0.5), transparent)',
        }}
      />
      <div className="px-5 pt-5 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-topo-6/12 border border-topo-6/25 flex items-center justify-center shrink-0">
            <Gauge size={18} className="text-topo-6" aria-hidden />
          </div>
          <div>
            <h3 className="font-body text-lg font-bold text-ink tracking-tight">Monitoring</h3>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider mt-0.5 max-w-md">
              Intervals and retention used by the dashboard (localStorage: {STORAGE_KEY})
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-topo-5 text-white font-mono text-[11px] font-bold tracking-wider hover:bg-topo-5/90 transition-colors disabled:opacity-60 shrink-0 shadow-lg shadow-topo-5/15"
          disabled={saved}
        >
          <Save size={13} />
          {saved ? 'Saved' : 'Save changes'}
        </button>
      </div>

      <div className="px-5 pb-5 space-y-8">
        {(['polling', 'lifecycle'] as const).map((groupKey) => {
          const list = byGroup[groupKey];
          const meta = GROUP_META[groupKey];
          return (
            <div key={groupKey}>
              <div className="mb-3">
                <h4 className="font-mono text-[10px] font-bold tracking-[0.22em] text-ink-muted uppercase">{meta.title}</h4>
                <p className="font-body text-xs text-ink-faint mt-1">{meta.blurb}</p>
                <div className="h-px bg-gradient-to-r from-contour-strong via-topo-5/20 to-transparent mt-3" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {list.map((field, i) => {
                  const globalIdx = fields.findIndex((f) => f.label === field.label);
                  return renderField(field, i, globalIdx >= 0 ? globalIdx : i);
                })}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
