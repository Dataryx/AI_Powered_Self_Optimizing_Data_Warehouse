import { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Clock, RefreshCw, BarChart3, LineChart, PieChart, Layers } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import SidebarPageShell from '../components/SidebarPageShell';
import MobileMenuButton from '../components/MobileMenuButton';
import AnalyticsStats from '../components/analytics/AnalyticsStats';
import QueryPerformanceImpact from '../components/analytics/QueryPerformanceImpact';
import WorkloadPatterns from '../components/analytics/WorkloadPatterns';
import WorkloadCacheMlPanels from '../components/analytics/WorkloadCacheMlPanels';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import { useWorkloadCacheInsights } from '../hooks/useWorkloadCacheInsights';
import { useMetricsAggregation } from '../hooks/useMonitoringPreferences';
import { formatLocalTime } from '../utils/time';

const jumpLinks = [
  { id: 'analytics-overview', label: 'Overview', icon: BarChart3 },
  { id: 'analytics-ml-workload-cache', label: 'Smart insights', icon: Layers },
  { id: 'analytics-queries', label: 'Slow queries', icon: LineChart },
  { id: 'analytics-workload', label: 'Busy times', icon: PieChart },
] as const;

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, loading, error, refetch, lastUpdatedAt, contractMeta, sectionHealth } = useAnalyticsData();
  const {
    workload: workloadInsight,
    cache: cacheInsight,
    loading: wcLoading,
    error: wcError,
    refetch: refetchWc,
  } = useWorkloadCacheInsights();
  const metricsAggregation = useMetricsAggregation();
  const refreshing = loading || wcLoading;

  const refreshAll = useCallback(() => {
    void Promise.all([refetch(), refetchWc()]);
  }, [refetch, refetchWc]);

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const id = location.hash.replace(/^#/, '');
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => clearTimeout(t);
  }, [location.hash, loading]);

  return (
    <SidebarPageShell className="bg-base topo-bg">
      <header className="min-h-14 border-b border-contour-strong bg-surface/80 backdrop-blur-xl flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2 sm:py-0 sticky top-0 z-40">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <MobileMenuButton />
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-ink-muted hover:text-ink transition-colors shrink-0"
          >
            <ChevronLeft size={16} aria-hidden />
            <span className="font-body text-sm">Back to home</span>
          </button>
          <span className="text-ink-faint hidden sm:inline" aria-hidden>
            /
          </span>
          <span className="font-body text-sm font-semibold text-ink truncate hidden sm:inline">Analytics</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/90 border border-contour-strong max-w-[220px] sm:max-w-none"
            title="Numbers update automatically and on refresh."
          >
            <Clock size={12} className="text-ink-muted shrink-0" aria-hidden />
            <span className="font-body text-[11px] text-ink-muted truncate">
              {lastUpdatedAt != null ? (
                <>Updated {formatLocalTime(lastUpdatedAt)}</>
              ) : (
                <>Waiting for first update</>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-base border border-contour px-2.5 py-1.5 text-ink-muted hover:text-ink hover:border-topo-4/30 transition-colors disabled:opacity-50"
            aria-label="Refresh analytics data"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin shrink-0' : 'shrink-0'} aria-hidden />
            <span className="font-body text-xs font-medium hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 pb-16 max-w-7xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div className="min-w-0">
              <h1 className="font-body text-2xl sm:text-3xl font-bold text-topo-1 tracking-tight">Analytics</h1>
              <p className="font-body text-sm text-ink-muted mt-1.5 max-w-xl leading-snug">
                Easy-to-read trends for query speed and workload behavior.
              </p>
            </div>
            <nav
              className="flex flex-wrap gap-1 shrink-0 p-1 rounded-xl bg-surface/90 border border-contour-strong shadow-sm"
              aria-label="Page sections"
            >
              {jumpLinks.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-body text-[11px] font-medium text-ink-muted hover:text-ink hover:bg-base/80 border border-transparent hover:border-contour/80 transition-colors"
                >
                  <Icon size={14} className="text-topo-4 shrink-0 opacity-90" aria-hidden />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </motion.div>

        {error && (
          <div
            className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-400"
            role="alert"
          >
            <p className="font-body text-sm font-medium">We couldn&apos;t load analytics</p>
            <p className="font-body text-sm mt-1 opacity-90">{error}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 font-body text-sm font-semibold underline underline-offset-2 hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}
        {!error && (contractMeta.degraded || sectionHealth.storage.degraded || sectionHealth.cost.degraded) && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300" role="status">
            <p className="font-body text-sm font-medium">Degraded data mode</p>
            <p className="font-body text-xs mt-1 opacity-90">
              {contractMeta.degraded
                ? `Core analytics fallback: ${contractMeta.degradedReason || 'unknown reason'}.`
                : 'Core analytics is healthy.'}
              {sectionHealth.storage.degraded ? ' Storage utilization is stale.' : ''}
              {sectionHealth.cost.degraded ? ' Storage cost is stale.' : ''}
            </p>
          </div>
        )}

        <AnalyticsStats data={data} loading={loading} />

        <div className="mt-6">
          <WorkloadCacheMlPanels
            workload={workloadInsight}
            cache={cacheInsight}
            loading={wcLoading}
            error={wcError}
            onRefresh={() => void refetchWc()}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-6">
          <QueryPerformanceImpact data={data} loading={loading} onRefresh={refetch} />
          <WorkloadPatterns
            data={data}
            loading={loading}
            onRefresh={refetch}
            metricsAggregation={metricsAggregation}
          />
        </div>

      </main>
    </SidebarPageShell>
  );
}
