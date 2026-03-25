import { motion } from 'framer-motion';
import { TrendingUp, RefreshCw } from 'lucide-react';

// Hourly usage data (0:00 - 23:00) - simulating the wavy pattern from the image
const hourlyData = [
  30, 25, 20, 22, 28, 35, 50, 70, 85, 95, 90, 88,
  92, 95, 100, 98, 95, 90, 105, 120, 140, 130, 110, 80
];

const maxVal = Math.max(...hourlyData);

const topTablesBySize = [
  { name: 'fact_sales', size: 3069 },
  { name: 'order_item', size: 2534 },
  { name: 'orders', size: 1043 },
  { name: 'fact_orders', size: 925 },
  { name: 'customer_employee', size: 79 },
];

const maxTableSize = topTablesBySize[0].size;

interface WorkloadPatternsProps { data?: any; loading?: boolean }

export default function WorkloadPatterns({ data, loading }: WorkloadPatternsProps) {
  const W = 600;
  const H = 160;
  const P = 35;

  // Build smooth area path
  const step = (W - P * 2) / (hourlyData.length - 1);
  const points = hourlyData.map((v, i) => ({
    x: P + i * step,
    y: H - 20 - ((v / maxVal) * (H - 40)),
  }));

  // Create smooth curve using cardinal spline approximation
  let linePath = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    linePath += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
  }

  const areaPath = `${linePath} L${points[points.length - 1].x},${H - 20} L${points[0].x},${H - 20} Z`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-surface rounded-2xl border border-topo-6/25 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-topo-5/12 flex items-center justify-center">
            <TrendingUp size={17} className="text-topo-5" />
          </div>
          <div>
            <h3 className="font-body text-base font-bold text-ink">Workload & Access Patterns</h3>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">How workloads access layers and tables</p>
          </div>
        </div>
        <button className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Metric badges */}
      <div className="px-5 pb-3 flex items-center gap-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-topo-6/10 font-mono text-[10px] text-topo-6 font-bold">
          0 tables
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-topo-1/10 font-mono text-[10px] text-topo-1 font-bold">
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/><line x1="3" y1="4" x2="7" y2="4" stroke="currentColor" strokeWidth="1"/><line x1="3" y1="6" x2="6" y2="6" stroke="currentColor" strokeWidth="1"/></svg>
          Peak: 22:00
        </span>
      </div>

      {/* Hourly Usage Pattern chart */}
      <div className="px-3">
        <p className="px-2 font-mono text-[10px] text-ink-muted mb-1">Hourly Usage Pattern</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {/* Y-axis gridlines */}
          {[0, 40, 80, 120, 160].map((val) => {
            const y = H - 20 - ((val / maxVal) * (H - 40));
            return (
              <g key={val}>
                <line x1={P} y1={y} x2={W - P} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="3 3" />
                <text x={P - 4} y={y + 3} textAnchor="end" className="fill-ink-faint" style={{ fontSize: '7px', fontFamily: 'Space Mono' }}>{val}</text>
              </g>
            );
          })}

          {/* Area fill with gradient */}
          <defs>
            <linearGradient id="workloadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <motion.path
            d={areaPath}
            fill="url(#workloadGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          />
          <motion.path
            d={linePath}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.3 }}
          />

          {/* X-axis labels */}
          {hourlyData.map((_, i) => {
            if (i % 1 === 0) {
              const x = P + i * step;
              return (
                <text key={i} x={x} y={H - 6} textAnchor="middle" className="fill-ink-faint" style={{ fontSize: '6px', fontFamily: 'Space Mono' }}>
                  {`${i}:00`}
                </text>
              );
            }
            return null;
          })}
        </svg>
      </div>

      {/* Top Tables by Size */}
      <div className="px-5 pb-5 mt-2">
        <p className="font-mono text-[10px] text-ink-muted mb-2">Top Tables by Size</p>
        <div className="space-y-1.5">
          {topTablesBySize.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 + 0.5 }}
              className="flex items-center gap-2"
            >
              <span className="font-mono text-[9px] text-ink-muted w-[100px] text-right truncate flex-shrink-0">{t.name}</span>
              <div className="flex-1 h-2.5 bg-base rounded-sm overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(t.size / maxTableSize) * 100}%` }}
                  transition={{ delay: i * 0.04 + 0.6, duration: 0.4 }}
                  className="h-full rounded-sm bg-topo-6"
                  style={{ opacity: 0.6 }}
                />
              </div>
              <span className="font-mono text-[8px] text-ink-faint w-12 text-right">{t.size} MB</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
