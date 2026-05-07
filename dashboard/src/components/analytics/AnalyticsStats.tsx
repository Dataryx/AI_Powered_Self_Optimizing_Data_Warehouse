import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Gauge, Clock, TrendingUp, Sun } from 'lucide-react';
import type { AnalyticsPageData } from '../../hooks/useAnalyticsData';
import {
  deriveQueryAggregates,
  derivePeakHourUtc,
  derivePeakHourUtcFromDbHourly,
  type QueryPerfRow,
} from '../../utils/analyticsDerived';

interface AnalyticsStatsProps {
  data?: AnalyticsPageData;
  loading?: boolean;
}

type StatCard = {
  key: string;
  icon: typeof Gauge;
  title: string;
  value: string;
  subline?: string;
};

function fmtSecs(s: number | undefined): string {
  if (s == null || !Number.isFinite(s)) return '—';
  if (s < 1) {
    const ms = s * 1000;
    if (ms < 0.1) return `${ms.toFixed(4)} ms`;
    if (ms < 1) return `${ms.toFixed(3)} ms`;
    if (ms < 10) return `${ms.toFixed(2)} ms`;
    return `${ms.toFixed(1)} ms`;
  }
  return `${s.toFixed(2)}s`;
}

export default function AnalyticsStats({ data, loading }: AnalyticsStatsProps) {
  const q1 = (data?.queryPerformance1d ?? []) as QueryPerfRow[];
  const q7 = (data?.queryPerformance7d ?? []) as QueryPerfRow[];
  const q30 = (data?.queryPerformance ?? []) as QueryPerfRow[];

  const stats = useMemo((): StatCard[] => {
    const a1 = deriveQueryAggregates(q1);
    const a7 = deriveQueryAggregates(q7);
    const hourlyDb = data?.hourlyCallsUtc7d;
    const peak =
      hourlyDb && hourlyDb.length === 24 ? derivePeakHourUtcFromDbHourly(hourlyDb) : derivePeakHourUtc(q7);
    const r1 = data?.queryLogRollup1d;
    const r7 = data?.queryLogRollup7d;
    const runsFromDb = r1 != null && r7 != null;

    const avg = a7.weightedAvgLatencySec;

    return [
      {
        key: 'runs',
        icon: Gauge,
        title: 'Queries run',
        value: runsFromDb && r1 && r7
          ? `${new Intl.NumberFormat().format(Math.round(r1.total_calls))} / ${new Intl.NumberFormat().format(Math.round(r7.total_calls))}`
          : `${new Intl.NumberFormat().format(a1.totalExecutions)} / ${new Intl.NumberFormat().format(a7.totalExecutions)}`,
        // subline: runsFromDb
        //   ? 'Calls in ml_optimization.query_logs (UTC 1d vs 7d windows; matches database)'
        //   : 'Execution totals for the current analytics window',
      },
      {
        key: 'slow',
        icon: TrendingUp,
        title: 'Slow query rate',
        value: a7.totalExecutions > 0 ? `${(a7.slowExecutionShare * 100).toFixed(1)}%` : '—',
        // subline: 'Share of queries marked slow',
      },
      {
        key: 'latency',
        icon: Clock,
        title: 'Typical wait time',
        value: fmtSecs(avg),
        // subline:
        //   baseline > 0
        //     ? `7-day weighted avg · long-window baseline ${baseline.toFixed(2)}s`
        //     : '7-day weighted average latency',
      },
      {
        key: 'peak',
        icon: Sun,
        title: 'Busiest hour',
        value: peak ? peak.label : '—',
        // subline: peak
        //   ? hourlyDb && hourlyDb.length === 24
        //     ? `${peak.executions.toLocaleString()} calls by UTC hour of collection (matches database)`
        //     : `${peak.executions.toLocaleString()} total runs by hour`
        //   : 'No peak hour available',
      },
    ];
  }, [q1, q7, q30, data?.hourlyCallsUtc7d, data?.queryLogRollup1d, data?.queryLogRollup7d]);

  return (
    <motion.div
      id="analytics-overview"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
    >
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.key}
            className="rounded-2xl border border-contour-strong bg-surface p-4 text-left shadow-sm hover:border-topo-4/25 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-topo-4/10 border border-topo-4/15 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-topo-4" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[11px] font-semibold !text-white leading-snug">{s.title}</p>
                <p
                  className={`font-body text-sm sm:text-base font-bold !text-white mt-1.5 tabular-nums leading-tight ${
                    loading ? 'animate-pulse !text-white/80' : ''
                  }`}
                >
                  {loading ? '…' : s.value}
                </p>
                {s.subline ? (
                  <p className="font-body text-[11px] !text-white/70 mt-1.5 leading-snug">{s.subline}</p>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
