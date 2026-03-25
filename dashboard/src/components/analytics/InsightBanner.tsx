import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface InsightBannerProps { data?: any; loading?: boolean }

export default function InsightBanner({ data, loading }: InsightBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Insight card */}
      <div className="bg-surface rounded-2xl border border-contour-strong p-5 mb-3">
        <span className="font-mono text-[10px] font-bold tracking-[0.25em] text-topo-5 uppercase block mb-2">Insight</span>
        <p className="font-body text-base font-semibold text-ink leading-snug">
          Peak usage overlaps with ETL execution, contributing to increased query latency during evening hours.
        </p>
        <p className="font-body text-sm text-ink-muted mt-1.5">
          This suggests shifting heavy ETL or optimization workloads outside peak hours to reduce contention.
        </p>
      </div>

      {/* Link bar */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-ink-faint">Analytics help evaluate the impact of applied optimizations.</span>
        <Link to="/optimizations" className="font-mono text-[11px] text-topo-5 font-bold hover:underline transition-all">
          View related optimization recommendations
        </Link>
      </div>
    </motion.div>
  );
}
