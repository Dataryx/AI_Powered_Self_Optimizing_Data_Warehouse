import { useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Bell, AlertTriangle } from 'lucide-react';
import { SettingsSwitch } from './SettingsSwitch';

interface AlertRule {
  name: string;
  description: string;
  severity: 'high' | 'medium' | 'warning' | 'low';
  threshold: string;
  thresholdLabel: string;
  enabled: boolean;
}

const severityStripe: Record<string, string> = {
  high: 'from-topo-1/90',
  medium: 'from-topo-2/90',
  warning: 'from-topo-3/90',
  low: 'from-topo-5/90',
};

const severityBadge: Record<string, string> = {
  high: 'bg-topo-1/15 text-topo-1 border-topo-1/35',
  medium: 'bg-topo-2/15 text-topo-2 border-topo-2/35',
  warning: 'bg-topo-3/15 text-topo-3 border-topo-3/35',
  low: 'bg-topo-5/15 text-topo-5 border-topo-5/35',
};

const initialRules: AlertRule[] = [
  {
    name: 'Slow Query',
    severity: 'high',
    description: 'Query execution time threshold (seconds)',
    threshold: '5',
    thresholdLabel: 'Threshold',
    enabled: true,
  },
  {
    name: 'Cache Hit Rate',
    severity: 'medium',
    description: 'Minimum cache hit rate (%)',
    threshold: '70',
    thresholdLabel: 'Threshold',
    enabled: true,
  },
  {
    name: 'Dead Tuples',
    severity: 'medium',
    description: 'Maximum dead tuple ratio (%)',
    threshold: '10',
    thresholdLabel: 'Threshold',
    enabled: true,
  },
  {
    name: 'Empty Table',
    severity: 'warning',
    description: 'Alert on empty tables',
    threshold: '0',
    thresholdLabel: 'Threshold',
    enabled: true,
  },
  {
    name: 'Large Table',
    severity: 'low',
    description: 'Large table size threshold (GB)',
    threshold: '10',
    thresholdLabel: 'Threshold',
    enabled: true,
  },
];

const STORAGE_KEY = 'dw-alert-settings';

export default function AlertSettings() {
  const [rules, setRules] = useState<AlertRule[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {
      /* ignore */
    }
    return initialRules;
  });
  const [saved, setSaved] = useState(false);

  const toggleRule = (idx: number) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, enabled: !r.enabled } : r)));
    setSaved(false);
  };

  const updateThreshold = (idx: number, val: string) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, threshold: val } : r)));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="relative bg-surface rounded-2xl border border-contour-strong overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-80"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(248,113,113,0.45), rgba(245,158,11,0.4), transparent)',
        }}
      />
      <div className="px-5 pt-5 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-topo-1/12 border border-topo-1/25 flex items-center justify-center shrink-0">
            <Bell size={18} className="text-topo-1" aria-hidden />
          </div>
          <div>
            <h3 className="font-body text-lg font-bold text-ink tracking-tight">Alert rules</h3>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider mt-0.5">
              <span className="text-topo-4 font-bold tabular-nums">{enabledCount}</span>
              <span className="text-ink-muted"> / {rules.length} active · localStorage</span>
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

      <div className="px-5 pb-5 space-y-2.5 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
        {rules.map((rule, i) => (
          <motion.div
            key={rule.name}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 + 0.08 }}
            className={`relative rounded-xl border overflow-hidden transition-colors ${
              rule.enabled ? 'border-contour-strong bg-base/45' : 'border-contour bg-base/25 opacity-80'
            }`}
          >
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${severityStripe[rule.severity]} to-transparent`}
              aria-hidden
            />
            <div className="pl-4 pr-3 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5 text-ink-faint shrink-0">
                    <AlertTriangle size={14} className="opacity-60" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-body text-sm font-semibold text-ink">{rule.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[8px] font-bold tracking-widest uppercase border ${severityBadge[rule.severity]}`}
                      >
                        {rule.severity}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-ink-muted mt-1 leading-relaxed">{rule.description}</p>
                  </div>
                </div>
                <SettingsSwitch
                  enabled={rule.enabled}
                  onChange={() => toggleRule(i)}
                  aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name} alert`}
                  className="self-start sm:self-center"
                />
              </div>
              <div className="mt-3 sm:pl-6">
                <label className="font-mono text-[8px] text-ink-faint tracking-[0.18em] uppercase block mb-1">
                  {rule.thresholdLabel}
                </label>
                <input
                  type="text"
                  value={rule.threshold}
                  onChange={(e) => updateThreshold(i, e.target.value)}
                  className="w-full sm:max-w-[200px] bg-surface border border-contour-strong rounded-lg px-3 py-2 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-topo-5/25 focus:border-topo-5/40 transition-all"
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
