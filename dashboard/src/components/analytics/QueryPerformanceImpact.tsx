import { motion } from 'framer-motion';
import { Activity, RefreshCw } from 'lucide-react';

interface QueryPerformanceImpactProps { data?: any; loading?: boolean }

export default function QueryPerformanceImpact({ data, loading }: QueryPerformanceImpactProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="bg-surface rounded-2xl border border-contour-strong overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-topo-6/12 flex items-center justify-center">
            <Activity size={17} className="text-topo-6" />
          </div>
          <div>
            <h3 className="font-body text-base font-bold text-ink">Query Performance Impact</h3>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">Impact of workload on query performance</p>
            <p className="font-mono text-[9px] text-ink-faint">Compared to pre-optimization baseline.</p>
          </div>
        </div>
        <button className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Metric badges */}
      <div className="px-5 pb-3 flex items-center gap-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-topo-6/10 font-mono text-[10px] text-topo-6 font-bold">
          0 queries
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-topo-1/10 font-mono text-[10px] text-topo-1 font-bold">
          <svg width="10" height="8" viewBox="0 0 10 8" className="text-topo-1"><path d="M1 6 Q3 2 5 5 T9 3" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
          0 slow
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-topo-4/10 font-mono text-[10px] text-topo-4 font-bold">
          Avg: 0.00s
        </span>
      </div>

      {/* Empty state */}
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-5">
        <span className="font-body text-sm text-ink-muted">Analytics will populate after sufficient workload execution.</span>
      </div>
    </motion.div>
  );
}
