import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { History, RefreshCw } from 'lucide-react';
import type { AnalyticsPageData } from '../../hooks/useAnalyticsData';
import { formatUsd, monthlyAppliesFromHistory, parseMonthlyStorageCost } from '../../utils/analyticsDerived';

interface OptimizationROIProps {
  data?: AnalyticsPageData;
  loading?: boolean;
  onRefresh?: () => void;
}

export default function OptimizationROI({ data, loading, onRefresh }: OptimizationROIProps) {
  const hist = data?.optimizationHistory ?? [];
  const points = useMemo(() => monthlyAppliesFromHistory(hist, 12), [hist]);
  const totalApplied = useMemo(() => points.reduce((s, p) => s + p.applied, 0), [points]);
  const totalEstImp = useMemo(() => points.reduce((s, p) => s + p.sumEstimatedImprovement, 0), [points]);
  const maxApplied = Math.max(1, ...points.map((p) => p.applied));

  const monthlyCost = useMemo(() => parseMonthlyStorageCost(data?.costTracking ?? null), [data?.costTracking]);

  const W = 800;
  const H = 180;
  const P = 40;
  const step = (W - P * 2) / Math.max(1, points.length - 1);

  const linePts = points.map((p, i) => {
    const x = P + i * step;
    const y = H - 25 - (p.applied / maxApplied) * (H - 55);
    return { x, y, ...p };
  });

  let linePath = linePts.length ? `M${linePts[0].x},${linePts[0].y}` : '';
  for (let i = 1; i < linePts.length; i++) {
    const prev = linePts[i - 1];
    const curr = linePts[i];
    const cpx = (prev.x + curr.x) / 2;
    linePath += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
  }

  return (
    <motion.div
      id="analytics-optimizations"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-surface rounded-2xl border border-contour-strong overflow-hidden scroll-mt-24"
    >
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-topo-1/12 flex items-center justify-center shrink-0">
            <History size={17} className="text-topo-1" />
          </div>
          <div className="min-w-0">
            <h2 className="font-body text-base font-bold text-ink">Completed improvements</h2>
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

      <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-topo-4/10 border border-topo-4/15 font-body text-[11px] text-topo-4 font-semibold">
          {totalApplied} completed in view
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-topo-5/10 border border-topo-5/15 font-body text-[11px] text-topo-5 font-semibold" title="Sum of estimated_improvement fields from history">
          Total expected impact score: {totalEstImp.toFixed(3)}
        </span>
        {monthlyCost != null ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-topo-1/10 border border-topo-1/15 font-body text-[11px] text-topo-1 font-semibold">
            Monthly storage cost ~{formatUsd(monthlyCost)}
          </span>
        ) : null}
      </div>

      <div className="px-5 pb-5">
        <p className="font-body text-[11px] text-ink-muted mb-2">Completed improvements per month</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const val = Math.round(t * maxApplied);
            const y = H - 25 - t * (H - 55);
            return (
              <g key={t}>
                <line x1={P} y1={y} x2={W - P} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="3 3" />
                <text x={P - 4} y={y + 3} textAnchor="end" className="fill-ink-faint" style={{ fontSize: '8px', fontFamily: 'Space Mono' }}>
                  {val}
                </text>
              </g>
            );
          })}
          <line x1={P} y1={H - 25} x2={W - P} y2={H - 25} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          {linePts.length >= 2 ? (
            <motion.path
              d={linePath}
              fill="none"
              stroke="#f87171"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8 }}
            />
          ) : null}
          {linePts.map((pt) => (
            <circle key={pt.key} cx={pt.x} cy={pt.y} r={pt.applied ? 3.5 : 2} fill="#f87171" opacity={pt.applied ? 0.9 : 0.25} />
          ))}
          {points.map((m, idx) => {
            const x = P + idx * step;
            return (
              <text key={m.key} x={x} y={H - 6} textAnchor="middle" className="fill-ink-faint" style={{ fontSize: '7px', fontFamily: 'Space Mono' }}>
                {m.label}
              </text>
            );
          })}
        </svg>
        {totalApplied === 0 ? (
          <p className="font-body text-xs text-ink-muted mt-3 text-center max-w-md mx-auto leading-relaxed">
            No completed improvements in this time window yet.
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
