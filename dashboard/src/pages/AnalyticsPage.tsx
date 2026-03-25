import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Radio, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SidebarPageShell from '../components/SidebarPageShell';
import MobileMenuButton from '../components/MobileMenuButton';
import AnalyticsStats from '../components/analytics/AnalyticsStats';
import QueryPerformanceImpact from '../components/analytics/QueryPerformanceImpact';
import WorkloadPatterns from '../components/analytics/WorkloadPatterns';
import InsightBanner from '../components/analytics/InsightBanner';
import OptimizationROI from '../components/analytics/OptimizationROI';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import { formatLocalTime } from '../utils/time';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useAnalyticsData();
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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
            <span className="font-body text-sm font-semibold text-ink truncate">Analytics</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-topo-4/10 border border-topo-4/20">
              <Radio size={10} className="text-topo-4 animate-pulse" />
              <span className="font-mono text-[9px] text-topo-4 font-bold tracking-widest uppercase">Live</span>
            </div>
            <span className="font-mono text-xs text-ink-soft tabular-nums">
              {formatLocalTime(time)}
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 pb-12 max-w-7xl mx-auto w-full">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h1 className="font-body text-2xl sm:text-3xl font-bold text-topo-1 tracking-tight">Analytics Dashboard</h1>
                <p className="font-body text-sm text-ink-muted mt-1">Query analytics, usage patterns, and cost-benefit analysis</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-topo-4/10 border border-topo-4/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-topo-4 animate-pulse" />
                  <span className="font-mono text-[9px] text-topo-4 font-bold tracking-widest">Live</span>
                </div>
                <span className="font-mono text-[10px] text-ink-faint">Updated: {formatLocalTime(time)}</span>
                <button type="button" onClick={refetch} className="w-8 h-8 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors" aria-label="Refresh">
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
          </motion.div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-sm font-mono">
              {error} — <button type="button" onClick={refetch} className="underline">Retry</button>
            </div>
          )}

          {/* Stats row */}
          <AnalyticsStats data={data} loading={loading} />

          {/* Query Performance + Workload Patterns */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
            <QueryPerformanceImpact data={data} loading={loading} />
            <WorkloadPatterns data={data} loading={loading} />
          </div>

          {/* Insight Banner */}
          <div className="mt-6">
            <InsightBanner data={data} loading={loading} />
          </div>

          {/* Optimization ROI */}
          <div className="mt-6 mb-10">
            <OptimizationROI data={data} loading={loading} />
          </div>
        </main>
    </SidebarPageShell>
  );
}
