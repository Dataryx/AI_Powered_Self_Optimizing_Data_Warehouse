import { useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Sparkles, Database, HardDrive, ShieldCheck, Activity, Sliders } from 'lucide-react';
import { SettingsSwitch } from './SettingsSwitch';

interface SettingItem {
  category: string;
  name: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
}

const initialSettings: SettingItem[] = [
  {
    category: 'OPTIMIZATION',
    name: 'Auto Optimization',
    description: 'Automatically apply optimization recommendations',
    icon: Sparkles,
    enabled: true,
  },
  {
    category: 'PERFORMANCE',
    name: 'Query Result Caching',
    description: 'Enable query result caching for improved performance',
    icon: Database,
    enabled: true,
  },
  {
    category: 'STORAGE',
    name: 'Data Compression',
    description: 'Enable data compression to reduce storage costs',
    icon: HardDrive,
    enabled: true,
  },
  {
    category: 'SECURITY',
    name: 'System Logging',
    description: 'Enable comprehensive system logging and audit trails',
    icon: ShieldCheck,
    enabled: true,
  },
  {
    category: 'MONITORING',
    name: 'Performance Tracking',
    description: 'Track query performance metrics and analytics',
    icon: Activity,
    enabled: true,
  },
];

export default function SystemSettings() {
  const [settings, setSettings] = useState<SettingItem[]>(() => initialSettings);
  const [saved, setSaved] = useState(false);

  const toggle = (idx: number) => {
    setSettings((prev) => prev.map((s, i) => (i === idx ? { ...s, enabled: !s.enabled } : s)));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const onCount = settings.filter((s) => s.enabled).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="rounded-lg border border-[#1e2540] bg-[#0c0f1a] overflow-hidden"
    >
      <div className="px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1e2540]">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-md bg-[#3ecfff12] border border-[#3ecfff25] flex items-center justify-center shrink-0">
            <Sliders size={18} className="text-[#3ecfff]" aria-hidden />
          </div>
          <div>
            <h3 className="font-body text-base font-semibold text-[#e0e8f5] tracking-tight">System preferences</h3>
            <p className="font-mono text-[10px] text-[#5a6a8a] tracking-wider mt-0.5">
              Feature flags for the warehouse experience ·{' '}
              <span className="text-[#c0cde0] font-bold tabular-nums">{onCount}</span>
              <span> / {settings.length} on</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-[#3ecfff35] bg-[#1a2235] text-[#e0e8f5] font-mono text-[11px] font-semibold tracking-wide hover:bg-[#243050] transition-colors disabled:opacity-60 shrink-0"
          disabled={saved}
        >
          <Save size={13} />
          {saved ? 'Applied ✓' : 'Apply'}
        </button>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {settings.map((setting, i) => {
            const Icon = setting.icon;
            return (
              <motion.div
                key={setting.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 + 0.08 }}
                className="rounded-lg border border-[#1e2540] bg-[#0a0e14] p-3 flex flex-col gap-2.5 h-full hover:border-[#2a3555] transition-colors"
              >
                <span className="font-mono text-[8px] font-bold tracking-[0.18em] text-[#5a6a8a] uppercase">
                  {setting.category}
                </span>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-[#12182a] border border-[#2a3555] flex items-center justify-center flex-shrink-0">
                      <Icon size={16} className="text-[#8a9aaa]" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-body text-sm font-semibold text-[#e0e8f5] block leading-snug">{setting.name}</span>
                      <span className="font-mono text-[10px] text-[#8a9aaa] leading-relaxed block mt-0.5">
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
    </motion.section>
  );
}
