import { useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Sparkles, Database, HardDrive, ShieldCheck, Activity, Sliders } from 'lucide-react';
import { SettingsSwitch } from './SettingsSwitch';

interface SettingItem {
  category: string;
  name: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  enabled: boolean;
}

const initialSettings: SettingItem[] = [
  {
    category: 'OPTIMIZATION',
    name: 'Auto Optimization',
    description: 'Automatically apply optimization recommendations',
    icon: Sparkles,
    iconColor: 'text-topo-3',
    iconBg: 'bg-topo-3/10',
    enabled: true,
  },
  {
    category: 'PERFORMANCE',
    name: 'Query Result Caching',
    description: 'Enable query result caching for improved performance',
    icon: Database,
    iconColor: 'text-topo-6',
    iconBg: 'bg-topo-6/10',
    enabled: true,
  },
  {
    category: 'STORAGE',
    name: 'Data Compression',
    description: 'Enable data compression to reduce storage costs',
    icon: HardDrive,
    iconColor: 'text-topo-5',
    iconBg: 'bg-topo-5/10',
    enabled: true,
  },
  {
    category: 'SECURITY',
    name: 'System Logging',
    description: 'Enable comprehensive system logging and audit trails',
    icon: ShieldCheck,
    iconColor: 'text-topo-2',
    iconBg: 'bg-topo-2/10',
    enabled: true,
  },
  {
    category: 'MONITORING',
    name: 'Performance Tracking',
    description: 'Track query performance metrics and analytics',
    icon: Activity,
    iconColor: 'text-topo-1',
    iconBg: 'bg-topo-1/10',
    enabled: true,
  },
];

const STORAGE_KEY = 'dw-system-settings';

export default function SystemSettings() {
  const [settings, setSettings] = useState<SettingItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === initialSettings.length) {
          return initialSettings.map((init, i) => ({ ...init, enabled: parsed[i]?.enabled ?? init.enabled }));
        }
      }
    } catch (_) {
      /* ignore */
    }
    return initialSettings;
  });
  const [saved, setSaved] = useState(false);

  const toggle = (idx: number) => {
    setSettings((prev) => prev.map((s, i) => (i === idx ? { ...s, enabled: !s.enabled } : s)));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(settings.map((s) => ({ name: s.name, enabled: s.enabled })))
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const onCount = settings.filter((s) => s.enabled).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative bg-surface rounded-2xl border border-contour-strong overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-80"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.5), rgba(129,140,248,0.45), transparent)',
        }}
      />
      <div className="px-5 pt-5 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-topo-4/12 border border-topo-4/25 flex items-center justify-center shrink-0">
            <Sliders size={18} className="text-topo-4" aria-hidden />
          </div>
          <div>
            <h3 className="font-body text-lg font-bold text-ink tracking-tight">System preferences</h3>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider mt-0.5">
              Feature flags for the warehouse experience ·{' '}
              <span className="text-topo-4 font-bold tabular-nums">{onCount}</span>
              <span className="text-ink-muted"> / {settings.length} on</span>
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

      <div className="px-5 pb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {settings.map((setting, i) => {
            const Icon = setting.icon;
            return (
              <motion.div
                key={setting.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 + 0.1 }}
                className="rounded-xl border border-contour-strong bg-base/40 p-4 flex flex-col gap-3 h-full hover:border-topo-5/20 transition-colors"
              >
                <span className="font-mono text-[8px] font-bold tracking-[0.2em] text-ink-faint uppercase">
                  {setting.category}
                </span>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl ${setting.iconBg} border border-white/5 flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon size={18} className={setting.iconColor} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-body text-sm font-semibold text-ink block leading-snug">{setting.name}</span>
                      <span className="font-mono text-[10px] text-ink-muted leading-relaxed block mt-1">
                        {setting.description}
                      </span>
                    </div>
                  </div>
                    <SettingsSwitch
                      enabled={setting.enabled}
                      onChange={() => toggle(i)}
                      aria-label={`${setting.enabled ? 'Disable' : 'Enable'} ${setting.name}`}
                    />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
