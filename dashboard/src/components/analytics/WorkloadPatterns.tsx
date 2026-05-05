import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, RefreshCw } from 'lucide-react';
import type { AnalyticsPageData } from '../../hooks/useAnalyticsData';
import {
  aggregationLabelToBucketHours,
  deriveWorkloadHourlyExecutions,
  peakFromRolledBuckets,
  rollupHourlyExecutions,
  topTablesFromStorage,
  type QueryPerfRow,
} from '../../utils/analyticsDerived';

interface WorkloadPatternsProps {
  data?: AnalyticsPageData;
  loading?: boolean;
  onRefresh?: () => void;
  /** Monitoring → Metrics aggregation (UTC bucket width for the workload curve). */
  metricsAggregation?: string;
}

export default function WorkloadPatterns({
  data,
  loading,
  onRefresh,
  metricsAggregation = '1 hour',
}: WorkloadPatternsProps) {
  const q = (data?.queryPerformance7d ?? []) as QueryPerfRow[];
  const bucketH = useMemo(() => aggregationLabelToBucketHours(metricsAggregation), [metricsAggregation]);
  const hourlyFromDb = data?.hourlyCallsUtc7d;
  const hourlyRawUtc = useMemo(() => {
    if (Array.isArray(hourlyFromDb) && hourlyFromDb.length === 24) {
      return hourlyFromDb.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0));
    }
    return deriveWorkloadHourlyExecutions(q);
  }, [hourlyFromDb, q]);
  const hourlySourceDb = Array.isArray(hourlyFromDb) && hourlyFromDb.length === 24;
  const localHourBuckets = useMemo(() => {
    const out = Array(24).fill(0);
    const offsetH = Math.round(-new Date().getTimezoneOffset() / 60);
    for (let utcH = 0; utcH < 24; utcH++) {
      const localH = (utcH + offsetH + 24) % 24;
      out[localH] = hourlyRawUtc[utcH] ?? 0;
    }
    return out;
  }, [hourlyRawUtc]);
  const rolled = useMemo(() => rollupHourlyExecutions(localHourBuckets, bucketH), [localHourBuckets, bucketH]);
  const hourlyData = rolled.values;
  const peak = useMemo(
    () => peakFromRolledBuckets(rolled.values, rolled.bucketLabels, { clock: 'local' }),
    [rolled],
  );
  const topTables = useMemo(() => topTablesFromStorage(data?.storageUtilization, 6), [data?.storageUtilization]);
  const tableCount = useMemo(() => {
    const u = data?.storageUtilization as { utilization?: Record<string, { table_count?: number }> } | null;
    if (!u?.utilization) return 0;
    return ['bronze', 'silver', 'gold'].reduce((s, sch) => s + (u.utilization![sch]?.table_count ?? 0), 0);
  }, [data?.storageUtilization]);

  const maxVal = Math.max(1, ...hourlyData);
  const W = 600;
  const H = 160;
  const P = 35;
  const nPts = Math.max(1, hourlyData.length);
  const step = nPts > 1 ? (W - P * 2) / (nPts - 1) : 0;
  const points = hourlyData.map((v, i) => ({
    x: nPts === 1 ? W / 2 : P + i * step,
    y: H - 20 - (maxVal > 0 ? (v / maxVal) * (H - 40) : 0),
  }));

  let linePath = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    linePath += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
  }
  const areaPath = `${linePath} L${points[points.length - 1].x},${H - 20} L${points[0].x},${H - 20} Z`;
  const peakIdx = hourlyData.length ? hourlyData.indexOf(Math.max(...hourlyData)) : -1;
  const barW = Math.max(3, Math.min(18, step * 0.62 || 12));
  const maxTableSize = Math.max(0.001, ...topTables.map((t) => t.sizeMb));

  return (
    <motion.div
      id="analytics-workload"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-surface rounded-2xl border border-topo-6/25 overflow-hidden flex flex-col scroll-mt-24"
    >
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-topo-5/12 flex items-center justify-center shrink-0">
            <TrendingUp size={17} className="text-topo-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-body text-base font-bold text-ink">Busy times and largest tables</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRefresh?.()}
          disabled={loading}
          className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-5 pb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-topo-6/10 border border-topo-6/15 font-body text-[11px] text-topo-6 font-semibold">
          {tableCount} tables monitored
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-topo-1/10 border border-topo-1/15 font-body text-[11px] text-topo-1 font-semibold">
          Busiest time: {peak ? `${peak.label.replace('UTC', '').trim()} (${peak.executions.toLocaleString()} runs)` : '—'}
        </span>
      </div>

      <div className="px-3">
        <div className="mb-1 flex items-center gap-3">
          <p className="font-body text-[10px] text-ink-faint">
            {hourlySourceDb ? 'Workload trend from source rollups' : 'Workload trend from available records'}
          </p>
        </div>
        <div className="mb-1 flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[10px] text-ink-faint">
            <span className="w-2.5 h-2.5 rounded-sm bg-topo-6/60 border border-topo-6/30" />
            Runs by time bucket
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-ink-faint">
            <span className="w-4 h-[2px] bg-topo-5 rounded-sm" />
            Trend line
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-ink-faint">
            <span className="w-2.5 h-2.5 rounded-full bg-topo-5/90 border border-topo-4/60" />
            Peak pointer (hover for details)
          </span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const val = Math.round(t * maxVal);
            const y = H - 20 - t * (H - 40);
            return (
              <g key={t}>
                <line x1={P} y1={y} x2={W - P} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="3 3" />
                <text x={P - 4} y={y + 3} textAnchor="end" className="fill-ink-faint" style={{ fontSize: '7px', fontFamily: 'Space Mono' }}>
                  {val}
                </text>
              </g>
            );
          })}
          <defs>
            <linearGradient id="workloadGradAnalytics" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <motion.path
            d={areaPath}
            fill="url(#workloadGradAnalytics)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          />
          <motion.path
            d={linePath}
            fill="none"
            stroke="#c084fc"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, delay: 0.15 }}
          />
          {peakIdx >= 0 && peakIdx < hourlyData.length ? (
            <circle
              cx={nPts === 1 ? W / 2 : P + peakIdx * step}
              cy={H - 20 - (maxVal > 0 ? (hourlyData[peakIdx] / maxVal) * (H - 40) : 0)}
              r={3}
              fill="rgba(196,132,252,0.95)"
              stroke="rgba(56,189,248,0.9)"
              strokeWidth={1}
              className="cursor-pointer"
            >
              <title>
                {`Peak: ${rolled.bucketLabels[peakIdx] ?? `${String(peakIdx).padStart(2, '0')}:00`} (${(hourlyData[peakIdx] ?? 0).toLocaleString()} calls)`}
              </title>
            </circle>
          ) : null}
          {hourlyData.map((_, i) => {
            if (nPts > 8 && i % 2 === 1) return null;
            const x = nPts === 1 ? W / 2 : P + i * step;
            const tick =
              bucketH <= 1
                ? `${String(i).padStart(2, '0')}:00`
                : rolled.bucketLabels[i]
                  ? rolled.bucketLabels[i].replace(':00–', '–').slice(0, 11)
                  : `${i}`;
            return (
              <text key={i} x={x} y={H - 6} textAnchor="middle" className="fill-ink-faint" style={{ fontSize: '6px', fontFamily: 'Space Mono' }}>
                {tick}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="px-5 pb-5 mt-2">
        <p className="font-body text-xs font-medium text-ink mb-2">Largest tables</p>
        {topTables.length === 0 ? (
          <p className="font-body text-xs text-ink-muted">Storage data is currently unavailable.</p>
        ) : (
          <div className="space-y-1.5">
            {topTables.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 + 0.2 }}
                className="flex items-center gap-2"
              >
                <span
                  className="font-body text-[11px] text-ink-muted w-[120px] sm:w-[140px] text-right truncate flex-shrink-0"
                  title={t.relationOid != null ? `${t.name} · pg_class.oid ${t.relationOid}` : t.name}
                >
                  {t.name}
                </span>
                <div className="flex-1 h-2.5 bg-base rounded-sm overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(t.sizeMb / maxTableSize) * 100}%` }}
                    transition={{ delay: i * 0.04 + 0.25, duration: 0.35 }}
                    className="h-full rounded-sm bg-topo-6"
                    style={{ opacity: 0.65 }}
                  />
                </div>
                <span className="font-body text-[10px] text-ink-muted w-14 text-right tabular-nums">{t.sizeMb < 1024 ? `${t.sizeMb.toFixed(0)} MB` : `${(t.sizeMb / 1024).toFixed(1)} GB`}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
