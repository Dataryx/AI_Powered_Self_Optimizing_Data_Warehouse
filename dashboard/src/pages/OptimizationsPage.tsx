import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Radio, RefreshCw, Gauge, DatabaseZap, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SidebarPageShell from '../components/SidebarPageShell';
import MobileMenuButton from '../components/MobileMenuButton';
import IndexRecommendations from '../components/optimizations/IndexRecommendations';
import PartitionRecommendations from '../components/optimizations/PartitionRecommendations';
import QueryPerformance from '../components/optimizations/QueryPerformance';
import OptimizationHistory from '../components/optimizations/OptimizationHistory';
import { useOptimizationsData } from '../hooks/useOptimizationsData';
import { utcPerformanceDateRange } from '../utils/queryPerformance';
import { formatLocalTime } from '../utils/time';
import { loadMonitoringPreferences } from '../settings/monitoringPreferences';

const TIME_RANGE_LABELS = ['Last 7 days', 'Last 30 days', 'Last 90 days'] as const;

function daysFromLabel(label: string): number {
  if (label === 'Last 7 days') return 7;
  if (label === 'Last 30 days') return 30;
  return 90;
}

function closestTimeRangeLabel(retentionDays: number): (typeof TIME_RANGE_LABELS)[number] {
  const n = Math.max(1, Math.min(3650, Math.round(Number(retentionDays)) || 30));
  const opts: [typeof TIME_RANGE_LABELS[number], number][] = [
    ['Last 7 days', 7],
    ['Last 30 days', 30],
    ['Last 90 days', 90],
  ];
  let best = opts[0]!;
  let bestDist = Math.abs(n - best[1]);
  for (const o of opts) {
    const d = Math.abs(n - o[1]);
    if (d < bestDist) {
      best = o;
      bestDist = d;
    }
  }
  return best[0];
}

export default function OptimizationsPage() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<(typeof TIME_RANGE_LABELS)[number]>(() =>
    closestTimeRangeLabel(loadMonitoringPreferences().retentionDays),
  );
  const performanceDays = useMemo(() => daysFromLabel(timeRange), [timeRange]);
  const queryPerfUtcWindow = useMemo(() => utcPerformanceDateRange(performanceDays), [performanceDays]);
  const {
    data,
    loading,
    error,
    queryPerformanceLoading,
    queryPerformanceError,
    refetch,
    stream,
  } = useOptimizationsData(performanceDays);
  const [recTab, setRecTab] = useState<'index' | 'partition'>('index');
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine,
  );
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  const streamLabel = !isOnline
    ? 'Offline'
    : stream.wsConnected
      ? 'Live'
      : stream.usingFallback
        ? 'Polling'
        : 'Connecting';
  const streamClass =
    !isOnline
      ? 'bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400'
      : stream.wsConnected
        ? 'bg-topo-4/10 border-topo-4/20 text-topo-4'
        : stream.usingFallback
          ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400'
          : 'bg-topo-5/10 border-topo-5/25 text-topo-5';
  const lastUpdated = stream.lastUpdate ?? clock;

  const indexCount =
    Array.isArray(data?.recommendations)
      ? data.recommendations.filter(
          (r: any) => (String(r?.type ?? 'index') || 'index').toLowerCase() === 'index',
        ).length
      : 0;
  const partitionCount =
    Array.isArray(data?.recommendations)
      ? data.recommendations.filter(
          (r: any) => String(r?.type ?? '').toLowerCase() === 'partition',
        ).length
      : 0;
  const totalRecCount = indexCount + partitionCount;
  const slowQueryCount =
    Array.isArray(data?.queryPerformance) && data.queryPerformance.length > 0
      ? data.queryPerformance.length
      : 0;

  return (
    <SidebarPageShell className="bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900">
        {/* Header */}
        <header className="min-h-14 border-b border-contour-strong/70 bg-surface/90 backdrop-blur-xl flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2 sm:py-0 sticky top-0 z-40">
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
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${streamClass}`}>
              <Radio size={10} className={stream.wsConnected && isOnline ? 'animate-pulse' : ''} />
              <span className="font-mono text-[9px] font-bold tracking-widest uppercase">{streamLabel}</span>
            </div>
            <span className="font-mono text-xs text-ink-soft tabular-nums">
              {formatLocalTime(clock)}
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
                <h1 className="font-body text-2xl sm:text-3xl font-bold text-ink tracking-tight">
                  Performance Optimization Center
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${streamClass}`}>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      stream.wsConnected && isOnline ? 'bg-topo-4 animate-pulse' : 'bg-ink-muted'
                    }`}
                  />
                  <span className="font-mono text-[9px] font-bold tracking-widest">{streamLabel}</span>
                </div>
                <span className="font-mono text-[10px] text-ink-faint whitespace-nowrap">
                  Last updated: {formatLocalTime(lastUpdated)}
                </span>
                <button type="button" onClick={refetch} className="w-8 h-8 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors" aria-label="Refresh">
                  <RefreshCw size={11} />
                </button>
              </div>
            </div>
          </motion.div>

          {/* KPI strip */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
          >
            <div className="rounded-2xl border border-contour bg-surface/80 px-4 py-3 flex items-center gap-3 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-xl bg-topo-6/15 flex items-center justify-center">
                <DatabaseZap size={18} className="text-topo-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-lg sm:text-xl text-ink font-semibold tabular-nums">
                    {totalRecCount}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint uppercase tracking-[0.18em]">
                    Recommendations
                  </span>
                </div>
                <p className="font-mono text-[10px] text-ink-soft mt-0.5">
                  {indexCount} index · {partitionCount} partition
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-contour bg-surface/80 px-4 py-3 flex items-center gap-3 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-xl bg-topo-5/15 flex items-center justify-center">
                <Gauge size={18} className="text-topo-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-lg sm:text-xl text-ink font-semibold tabular-nums">
                    {slowQueryCount}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint uppercase tracking-[0.18em]">
                    Slow queries
                  </span>
                </div>
                <p className="font-mono text-[10px] text-ink-soft mt-0.5">
                  Sorted by total run time in the selected period.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-contour bg-surface/80 px-4 py-3 flex items-center gap-3 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-xl bg-topo-2/15 flex items-center justify-center">
                <Layers size={18} className="text-topo-2" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-lg sm:text-xl text-ink font-semibold tabular-nums">
                    {stream.wsConnected ? 'Live' : stream.usingFallback ? 'Polling' : 'Idle'}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint uppercase tracking-[0.18em]">
                    Update mode
                  </span>
                </div>
                <p className="font-mono text-[10px] text-ink-soft mt-0.5">
                  Recommendations, query health, and history
                </p>
              </div>
            </div>
          </motion.div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-sm font-mono">
              {error} — <button type="button" onClick={refetch} className="underline">Retry</button>
            </div>
          )}

          {/* Recommendations (tabbed) */}
          <div className="mt-4 rounded-3xl border border-contour-strong/60 bg-surface/40 backdrop-blur-xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-contour/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-topo-4/12 border border-contour/40 flex items-center justify-center">
                    <DatabaseZap size={18} className="text-topo-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-body text-base font-bold text-ink truncate">Recommendations</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="inline-flex p-1 rounded-2xl border border-contour-strong/50 bg-base/50 backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => setRecTab('index')}
                      className={`px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold transition-colors ${
                        recTab === 'index'
                          ? 'bg-topo-6/25 text-topo-6 border border-topo-6/40'
                          : 'bg-transparent text-ink-faint hover:text-ink'
                      }`}
                      aria-pressed={recTab === 'index'}
                    >
                      Index <span className="ml-1 text-ink-soft tabular-nums">{indexCount}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecTab('partition')}
                      className={`px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold transition-colors ${
                        recTab === 'partition'
                          ? 'bg-topo-2/25 text-topo-2 border border-topo-2/40'
                          : 'bg-transparent text-ink-faint hover:text-ink'
                      }`}
                      aria-pressed={recTab === 'partition'}
                    >
                      Partition{' '}
                      <span className="ml-1 text-ink-soft tabular-nums">{partitionCount}</span>
                    </button>
                  </div>

                  <div className="hidden sm:block font-mono text-[10px] text-ink-faint whitespace-nowrap">
                    Total: <span className="text-ink-soft tabular-nums">{totalRecCount}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4">
              {recTab === 'index' ? (
                <IndexRecommendations data={data} loading={loading} onRefetch={refetch} />
              ) : (
                <PartitionRecommendations data={data} loading={loading} onRefetch={refetch} />
              )}
            </div>
          </div>

          {/* Query Performance Analysis */}
          <div className="mt-6">
            <div className="rounded-3xl border border-contour-strong/50 bg-surface/30 backdrop-blur-xl p-1">
              <QueryPerformance
                data={data}
                loading={queryPerformanceLoading}
                perfError={queryPerformanceError}
                timeRange={timeRange}
                dateWindowUtc={`${queryPerfUtcWindow.startDate} → ${queryPerfUtcWindow.endDate}`}
                onTimeRangeChange={(r) => {
                  if (r === 'Last 7 days' || r === 'Last 30 days' || r === 'Last 90 days') setTimeRange(r);
                }}
                timeRangeOptions={Array.from(TIME_RANGE_LABELS)}
              />
            </div>
          </div>

          {/* Optimization History */}
          <div className="mt-6 mb-10">
            <div className="rounded-3xl border border-contour-strong/50 bg-surface/30 backdrop-blur-xl p-1">
              <OptimizationHistory data={data} loading={loading} />
            </div>
          </div>
        </main>
    </SidebarPageShell>
  );
}
