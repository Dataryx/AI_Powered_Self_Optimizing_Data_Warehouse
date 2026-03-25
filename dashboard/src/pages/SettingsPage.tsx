import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Radio, RefreshCw, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SidebarPageShell from '../components/SidebarPageShell';
import MobileMenuButton from '../components/MobileMenuButton';
import AlertSettings from '../components/settings/AlertSettings';
import MonitoringSettings from '../components/settings/MonitoringSettings';
import SystemSettings from '../components/settings/SystemSettings';
import { formatLocalTime } from '../utils/time';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = formatLocalTime(time);
  const refreshStr = formatLocalTime(lastRefresh);

  return (
    <SidebarPageShell className="bg-base">
      <header className="min-h-14 border-b border-contour-strong bg-surface/85 backdrop-blur-xl flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2 sm:py-0 sticky top-0 z-40">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <MobileMenuButton />
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-ink-muted hover:text-ink transition-colors shrink-0"
          >
            <ChevronLeft size={16} />
            <span className="font-mono text-[11px] tracking-wider">Home</span>
          </button>
          <span className="text-ink-faint">/</span>
          <span className="font-body text-sm font-semibold text-ink truncate">Settings</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-topo-4/10 border border-topo-4/25">
            <Radio size={10} className="text-topo-4 animate-pulse" />
            <span className="font-mono text-[9px] text-topo-4 font-bold tracking-widest uppercase">Live</span>
          </div>
          <span className="font-mono text-xs text-ink-soft tabular-nums hidden sm:inline">{timeStr}</span>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 pb-14 max-w-7xl mx-auto w-full relative">
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            background:
              'radial-gradient(ellipse 720px 520px at 20% 12%, rgba(62,207,255,0.045) 0%, transparent 65%), radial-gradient(ellipse 560px 480px at 88% 72%, rgba(129,140,248,0.04) 0%, transparent 65%)',
          }}
        />

        <div className="relative z-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-topo-5/12 border border-topo-5/25 flex items-center justify-center shrink-0">
                    <Settings2 size={20} className="text-topo-5" aria-hidden />
                  </div>
                  <div>
                    <h1 className="font-body text-2xl sm:text-3xl font-bold text-ink tracking-tight">
                      Monitoring System Settings
                    </h1>
                    <p className="font-body text-sm text-ink-muted mt-1 sm:mt-0 max-w-xl">
                      Alerts, polling intervals, retention, and warehouse behavior — stored locally in your browser until
                      the API supports persistence.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="rounded-xl border border-contour-strong bg-surface-alt/60 px-3 py-2">
                  <span className="font-mono text-[8px] text-ink-faint tracking-[0.2em] uppercase block">
                    Page clock
                  </span>
                  <span className="font-mono text-xs text-ink-soft tabular-nums">{timeStr}</span>
                </div>
                <div className="rounded-xl border border-contour-strong bg-surface-alt/60 px-3 py-2">
                  <span className="font-mono text-[8px] text-ink-faint tracking-[0.2em] uppercase block">
                    Last refresh
                  </span>
                  <span className="font-mono text-xs text-ink-soft tabular-nums">{refreshStr}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLastRefresh(new Date())}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-contour-strong text-ink-muted hover:text-ink hover:border-topo-5/30 transition-colors font-mono text-[11px] font-bold tracking-wider"
                  aria-label="Mark refresh time"
                >
                  <RefreshCw size={14} className="text-topo-5" />
                  Sync clock
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {['Alerts', 'Monitoring', 'System'].map((label, i) => (
                <span
                  key={label}
                  className="font-mono text-[9px] tracking-wider px-2.5 py-1 rounded-lg border border-contour-strong text-ink-muted bg-surface-alt/40"
                >
                  <span className="text-topo-5 font-bold tabular-nums mr-1.5">{String(i + 1).padStart(2, '0')}</span>
                  {label}
                </span>
              ))}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <AlertSettings />
            <MonitoringSettings />
          </div>

          <SystemSettings />

          <div className="h-8" />
        </div>
      </main>
    </SidebarPageShell>
  );
}
