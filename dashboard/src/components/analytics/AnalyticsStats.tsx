import { motion } from 'framer-motion';

const stats = [
  { label: 'Total Queries', value: '0 (24h) / 0 (7d)' },
  { label: '% Slow Queries', value: '\u2014' },
  { label: 'Avg Query Latency (vs baseline)', value: '0.000s (baseline \u2014)' },
  { label: 'Peak Usage Hour', value: '19:00' },
  { label: 'Estimated Monthly Savings', value: '\u2014' },
];

interface AnalyticsStatsProps { data?: any; loading?: boolean }

export default function AnalyticsStats({ data, loading }: AnalyticsStatsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="grid grid-cols-2 md:grid-cols-5 gap-px bg-contour rounded-2xl overflow-hidden border border-contour-strong"
    >
      {stats.map((s) => (
        <div key={s.label} className="bg-surface p-4 text-center">
          <span className="font-mono text-[9px] text-ink-faint tracking-widest uppercase block mb-1.5">{s.label}</span>
          <span className="font-body text-base font-bold text-ink block leading-tight">{s.value}</span>
        </div>
      ))}
    </motion.div>
  );
}
