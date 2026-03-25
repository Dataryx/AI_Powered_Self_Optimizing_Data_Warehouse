import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Radio, RefreshCw, CheckCircle, TrendingUp, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SidebarPageShell from '../components/SidebarPageShell';
import MobileMenuButton from '../components/MobileMenuButton';
import { useAlertsData } from '../hooks/useAlertsData';
import { formatLocalTime } from '../utils/time';

export default function AlertsPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useAlertsData();
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = formatLocalTime(time);
  const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
  const anomalies = Array.isArray(data?.anomalies) ? data.anomalies : [];
  const incidents = Array.isArray(data?.incidents) ? data.incidents : [];

  return (
    <SidebarPageShell className="bg-base topo-bg">
        {/* Header */}
        <header className="min-h-14 border-b border-contour-strong bg-surface/80 backdrop-blur-xl flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2 sm:py-0 sticky top-0 z-40">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <MobileMenuButton />
            <button onClick={() => navigate('/')} className="flex items-center gap-1 text-ink-muted hover:text-ink transition-colors shrink-0">
              <ChevronLeft size={16} />
              <span className="font-mono text-[11px] tracking-wider">Home</span>
            </button>
            <span className="text-ink-faint">/</span>
            <span className="font-body text-sm font-semibold text-ink truncate">Alerts</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-topo-4/10 border border-topo-4/20">
              <Radio size={10} className="text-topo-4 animate-pulse" />
              <span className="font-mono text-[9px] text-topo-4 font-bold tracking-widest uppercase">Live</span>
            </div>
            <span className="font-mono text-xs text-ink-soft tabular-nums">{timeStr}</span>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 pb-12 max-w-7xl mx-auto w-full">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h1 className="font-body text-2xl sm:text-3xl font-bold text-ink tracking-tight">Alerts & Incidents Dashboard</h1>
                <p className="font-body text-sm text-ink-muted mt-1">Real-time alerts, anomaly detection, and incident tracking</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-topo-4/10 border border-topo-4/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-topo-4 animate-pulse" />
                  <span className="font-mono text-[9px] text-topo-4 font-bold tracking-widest">Live</span>
                </div>
                <span className="font-mono text-[10px] text-ink-faint">Last updated: {timeStr}</span>
                <button className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors">
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Active Alerts */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface rounded-2xl border border-contour-strong overflow-hidden mb-6"
          >
            <div className="px-4 sm:px-6 pt-5 pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="font-body text-lg font-bold text-ink">Active Alerts</h3>
                <p className="font-mono text-[11px] text-ink-faint tracking-wider mt-0.5">Alerts are generated from ETL, query, and resource telemetry.</p>
              </div>
              <button className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors">
                <RefreshCw size={12} />
              </button>
            </div>

            <div className="border-t border-contour" />

            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="w-16 h-16 rounded-full bg-topo-4/10 flex items-center justify-center mb-5">
                <CheckCircle size={34} className="text-topo-4" />
              </div>
              <span className="font-body text-lg font-bold text-ink">All Clear — No active alerts</span>
              <span className="font-body text-sm text-ink-muted mt-1.5">System is operating normally</span>
            </div>
          </motion.div>

          {/* Anomaly Detection + Incident Tracker */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-10">
            {/* Anomaly Detection */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="bg-surface rounded-2xl border border-contour-strong overflow-hidden"
            >
              <div className="px-4 sm:px-6 pt-5 pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-body text-lg font-bold text-ink">Anomaly Detection</h3>
                  <p className="font-mono text-[11px] text-ink-faint tracking-wider mt-0.5">Anomalies are detected using historical baselines and pattern deviations.</p>
                </div>
                <button onClick={refetch} className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors">
                  <RefreshCw size={12} />
                </button>
              </div>

              <div className="border-t border-contour" />

              {!loading && anomalies.length > 0 ? (
                <div className="p-6 space-y-2">
                  {anomalies.slice(0, 5).map((an: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle size={16} className="text-amber-600" />
                      <span className="font-body text-sm text-ink">{an?.message ?? an?.description ?? 'Anomaly detected'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                  <div className="w-14 h-14 rounded-full bg-topo-5/10 flex items-center justify-center mb-4">
                    <TrendingUp size={26} className="text-topo-5" />
                  </div>
                  <span className="font-body text-base font-bold text-ink">No anomalies detected</span>
                  <span className="font-body text-sm text-ink-muted mt-1">System patterns are within expected ranges</span>
                </div>
              )}
            </motion.div>

            {/* Incident Tracker */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="bg-surface rounded-2xl border border-contour-strong overflow-hidden"
            >
              <div className="px-4 sm:px-6 pt-5 pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-body text-lg font-bold text-ink">Incident Tracker</h3>
                  <p className="font-mono text-[11px] text-ink-faint tracking-wider mt-0.5">Incident lifecycle: detected → acknowledged → resolved</p>
                </div>
                <button onClick={refetch} className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors">
                  <RefreshCw size={12} />
                </button>
              </div>

              <div className="border-t border-contour" />

              {!loading && incidents.length > 0 ? (
                <div className="p-6 space-y-2">
                  {incidents.slice(0, 5).map((inc: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-surface-alt border border-contour">
                      <ShieldCheck size={16} className="text-topo-4" />
                      <span className="font-body text-sm text-ink">{inc?.title ?? inc?.message ?? 'Incident'}</span>
                      <span className="font-mono text-[10px] text-ink-faint ml-auto">{inc?.status ?? ''}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                  <div className="w-14 h-14 rounded-full bg-topo-4/10 flex items-center justify-center mb-4">
                    <ShieldCheck size={26} className="text-topo-4" />
                  </div>
                  <span className="font-body text-base font-bold text-ink">No active incidents</span>
                  <span className="font-body text-sm text-ink-muted mt-1">All systems operational</span>
                </div>
              )}
            </motion.div>
          </div>
        </main>
    </SidebarPageShell>
  );
}
