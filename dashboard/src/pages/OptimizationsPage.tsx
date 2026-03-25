import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Radio, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SidebarPageShell from '../components/SidebarPageShell';
import MobileMenuButton from '../components/MobileMenuButton';
import IndexRecommendations from '../components/optimizations/IndexRecommendations';
import PartitionRecommendations from '../components/optimizations/PartitionRecommendations';
import QueryPerformance from '../components/optimizations/QueryPerformance';
import OptimizationHistory from '../components/optimizations/OptimizationHistory';
import { useOptimizationsData } from '../hooks/useOptimizationsData';
import { formatLocalTime } from '../utils/time';

export default function OptimizationsPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useOptimizationsData();
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
            <span className="font-body text-sm font-semibold text-ink truncate">Optimizations</span>
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
                <h1 className="font-body text-2xl sm:text-3xl font-bold text-ink tracking-tight">Optimization Dashboard</h1>
                <p className="font-body text-sm text-ink-muted mt-1">ML-powered optimization recommendations, query performance analysis, and optimization history</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-mono text-[10px] text-ink-faint bg-surface-alt border border-contour px-2.5 py-1 rounded-lg hidden sm:inline">Optimization policy v1.0</span>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-topo-4/10 border border-topo-4/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-topo-4 animate-pulse" />
                  <span className="font-mono text-[9px] text-topo-4 font-bold tracking-widest">Live</span>
                </div>
                <span className="font-mono text-[10px] text-ink-faint whitespace-nowrap">Last updated: {formatLocalTime(time)}</span>
                <button type="button" onClick={refetch} className="w-8 h-8 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors" aria-label="Refresh">
                  <RefreshCw size={11} />
                </button>
              </div>
            </div>
          </motion.div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-sm font-mono">
              {error} — <button type="button" onClick={refetch} className="underline">Retry</button>
            </div>
          )}

          {/* Index + Partition Recommendations */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <IndexRecommendations data={data} loading={loading} onRefetch={refetch} />
            <PartitionRecommendations data={data} loading={loading} onRefetch={refetch} />
          </div>

          {/* Query Performance Analysis */}
          <div className="mt-6">
            <QueryPerformance data={data} loading={loading} />
          </div>

          {/* Optimization History */}
          <div className="mt-6 mb-10">
            <OptimizationHistory data={data} loading={loading} />
          </div>
        </main>
    </SidebarPageShell>
  );
}
