import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Radio, Settings2, Bell, Sliders } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SidebarPageShell from '../components/SidebarPageShell';
import MobileMenuButton from '../components/MobileMenuButton';
import AlertSettings from '../components/settings/AlertSettings';
import SystemSettings from '../components/settings/SystemSettings';
import { formatLocalTime } from '../utils/time';

type SettingsTab = 'alerts' | 'system';

const TABS: {
  id: SettingsTab;
  label: string;
  hint: string;
  icon: typeof Bell;
}[] = [
  {
    id: 'alerts',
    label: 'Alert rules',
    hint: 'Server-side thresholds',
    icon: Bell,
  },
  {
    id: 'system',
    label: 'Preferences',
    hint: 'Local feature flags',
    icon: Sliders,
  },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [tab, setTab] = useState<SettingsTab>('alerts');

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = formatLocalTime(time);

  return (
    <SidebarPageShell className="bg-[#0a0d18] min-h-screen text-[#c0cde0]">
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 800px 600px at 30% 20%, rgba(62,207,255,0.03) 0%, transparent 70%), radial-gradient(ellipse 600px 500px at 80% 70%, rgba(167,139,250,0.02) 0%, transparent 70%)',
        }}
      />

      <header className="relative z-40 min-h-14 bg-[#0c0f1a] border-b border-[#1e2540] sticky top-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2 sm:py-0 sm:min-h-14 sm:items-center">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <MobileMenuButton variant="dark" />
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-1 text-[#5a6a8a] hover:text-[#c0cde0] transition-colors shrink-0"
            >
              <ChevronLeft size={16} />
              <span className="font-mono text-[11px] tracking-wider">Home</span>
            </button>
            <span className="text-[#2a3555] hidden sm:inline" aria-hidden>
              /
            </span>
            <span className="sm:hidden font-body text-sm font-semibold text-[#c0cde0] truncate min-w-0">Settings</span>
            <div className="items-center gap-2 min-w-0 hidden sm:flex">
              <Settings2 size={14} className="text-[#3ecfff] shrink-0" aria-hidden />
              <span className="font-body text-sm font-semibold text-[#c0cde0] truncate">Settings</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0d3a2a] border border-[#1a5c40]">
              <Radio size={10} className="text-[#34d399] animate-pulse" aria-hidden />
              <span className="font-mono text-[9px] text-[#34d399] font-bold tracking-widest uppercase">Live</span>
            </div>
            <span className="font-mono text-xs text-[#5a6a8a] tabular-nums">{timeStr}</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 sm:px-6 lg:px-8 py-5 pb-16 max-w-7xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#3ecfff12] border border-[#3ecfff25] flex items-center justify-center shrink-0">
              <Settings2 size={16} className="text-[#3ecfff]" aria-hidden />
            </div>
            <h1 className="font-body text-2xl sm:text-3xl font-bold text-[#e0e8f5] tracking-tight">Settings</h1>
          </div>
          <p className="font-body text-sm text-[#5a6a8a] ml-0 sm:ml-10 mt-1 sm:mt-0 max-w-2xl">
            Tune alert rules on the API and local preferences.
          </p>
        </motion.div>

        <div
          className="rounded-lg border border-[#1e2540] bg-[#0c0f1a] flex flex-col sm:flex-row sm:items-stretch overflow-hidden mb-6"
          role="tablist"
          aria-label="Settings sections"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={[
                  'flex-1 flex items-center gap-2 px-3 py-2.5 text-left transition-colors relative',
                  active
                    ? 'text-[#e0e8f5] bg-[#12182a] after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-[#3ecfff]'
                    : 'text-[#5a6a8a] hover:text-[#c0cde0] hover:bg-[#0a0e14]',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-md border shrink-0',
                    active ? 'border-[#3ecfff35] bg-[#3ecfff10] text-[#3ecfff]' : 'border-[#2a3555] bg-[#0a0e14]',
                  ].join(' ')}
                >
                  <Icon size={16} strokeWidth={1.65} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="font-body text-xs font-semibold block leading-tight">{t.label}</span>
                  <span className="font-mono text-[9px] text-[#5a6a8a] block mt-0.5 leading-tight">{t.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'alerts' ? <AlertSettings /> : null}
            {tab === 'system' ? <SystemSettings /> : null}
          </motion.div>
        </AnimatePresence>
      </main>
    </SidebarPageShell>
  );
}
