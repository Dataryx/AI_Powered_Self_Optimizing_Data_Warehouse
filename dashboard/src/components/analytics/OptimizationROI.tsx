import { motion } from 'framer-motion';
import { DollarSign, RefreshCw, Info } from 'lucide-react';

// 12-month ROI trend data (all zeros/flat for this state)
const roiMonths = ['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb'];
// ROI values currently at baseline

interface OptimizationROIProps { data?: any; loading?: boolean }

export default function OptimizationROI({ data, loading }: OptimizationROIProps) {
  const W = 800;
  const H = 180;
  const P = 40;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-surface rounded-2xl border border-contour-strong overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-topo-1/12 flex items-center justify-center">
            <DollarSign size={17} className="text-topo-1" />
          </div>
          <div>
            <h3 className="font-body text-base font-bold text-ink">Optimization Impact (ROI)</h3>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">ROI and savings from applied optimizations</p>
          </div>
        </div>
        <button className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Info lines */}
      <div className="px-5 pb-3">
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-topo-2/6 border border-topo-2/12 mb-3">
          <Info size={13} className="text-topo-2 flex-shrink-0 mt-0.5" />
          <div className="font-mono text-[10px] text-ink-soft leading-relaxed">
            <p>Metrics reflect the impact of applied optimizations.</p>
            <p>Baseline derived from pre-optimization performance metrics.</p>
            <p>Compared to pre-optimization baseline.</p>
          </div>
        </div>
      </div>

      {/* Metric badges */}
      <div className="px-5 pb-4 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-topo-4/10 font-mono text-[11px] text-topo-4 font-bold">
          <DollarSign size={11} />
          $0.00/mo
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-topo-5/10 font-mono text-[11px] text-topo-5 font-bold">
          <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M4 6h4M6 4v4" stroke="currentColor" strokeWidth="1"/></svg>
          $0.00 saved
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-topo-1/10 font-mono text-[11px] text-topo-1 font-bold">
          <svg width="12" height="10" viewBox="0 0 12 10"><path d="M1 8 Q4 2 6 5 T11 3" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
          65.0% ROI
        </span>
      </div>

      {/* ROI Trend chart */}
      <div className="px-5 pb-5">
        <p className="font-mono text-[10px] text-ink-muted mb-2">ROI Trend (12 Months)</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {/* Y-axis gridlines */}
          {[0, 25, 50, 75, 100].map((val) => {
            const y = H - 25 - ((val / 100) * (H - 50));
            return (
              <g key={val}>
                <line x1={P} y1={y} x2={W - P} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="3 3" />
                <text x={P - 4} y={y + 3} textAnchor="end" className="fill-ink-faint" style={{ fontSize: '8px', fontFamily: 'Space Mono' }}>{val}%</text>
              </g>
            );
          })}

          {/* Baseline zero line */}
          <line x1={P} y1={H - 25} x2={W - P} y2={H - 25} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

          {/* Data line (flat at 0) */}
          <line x1={P} y1={H - 25} x2={W - P} y2={H - 25} stroke="#f87171" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

          {/* X-axis month labels */}
          {roiMonths.map((m, i) => {
            const step = (W - P * 2) / (roiMonths.length - 1);
            const x = P + i * step;
            return (
              <text key={m} x={x} y={H - 6} textAnchor="middle" className="fill-ink-faint" style={{ fontSize: '8px', fontFamily: 'Space Mono' }}>{m}</text>
            );
          })}

          {/* Data points */}
          {roiMonths.map((_, i) => {
            const step = (W - P * 2) / (roiMonths.length - 1);
            const x = P + i * step;
            return <circle key={i} cx={x} cy={H - 25} r={3} fill="#f87171" opacity={0.4} />;
          })}
        </svg>
      </div>
    </motion.div>
  );
}
