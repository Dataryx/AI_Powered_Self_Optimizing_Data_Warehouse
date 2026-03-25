import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { formatLocalTime } from '../../utils/time';

const ranges = ['7d', '30d', '90d'];

function getTrendSeries(data: any): { dates: string[]; bronze: number[]; silver: number[]; gold: number[]; maxVal: number; periodDays?: number } {
  const growth = data?.growth;
  const points = growth?.trend_points ?? data?.trend_points ?? [];
  if (!points.length) {
    return { dates: [], bronze: [], silver: [], gold: [], maxVal: 1, periodDays: undefined };
  }
  const dates = points.map((p: any) => (p.date != null ? String(p.date) : ''));
  const bronze = points.map((p: any) => Number(p.bronze) || 0);
  const silver = points.map((p: any) => Number(p.silver) || 0);
  const gold = points.map((p: any) => Number(p.gold) || 0);
  const maxVal = Math.max(1, ...bronze, ...silver, ...gold);
  return { dates, bronze, silver, gold, maxVal, periodDays: growth?.period_days };
}

function buildPolyline(values: number[], maxVal: number, w: number, h: number, pad: number): string {
  if (values.length === 0) return '';
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v / maxVal) * (h - pad * 2));
    return `${x},${y}`;
  }).join(' ');
}

function buildAreaPath(values: number[], maxVal: number, w: number, h: number, pad: number): string {
  if (values.length === 0) return '';
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v / maxVal) * (h - pad * 2));
    return `${x},${y}`;
  });
  const lastX = pad + (values.length - 1) * step;
  return `M${points[0]} ${points.slice(1).map(p => `L${p}`).join(' ')} L${lastX},${h - pad} L${pad},${h - pad} Z`;
}

interface DataGrowthTrendsProps { data?: any; loading?: boolean; onRefetch?: () => void }

export default function DataGrowthTrends({ data, loading, onRefetch }: DataGrowthTrendsProps) {
  const [activeRange, setActiveRange] = useState('30d');
  const { dates, bronze, silver, gold, maxVal, periodDays } = getTrendSeries(data);
  const W = 900;
  const H = 280;
  const P = 45;
  const hasData = dates.length > 0;
  const periodLabel = periodDays != null ? `Last ${periodDays}d` : '';

  return (
    <div className="bg-surface rounded-2xl border border-contour-strong overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-topo-2/10 flex items-center justify-center">
            <TrendingUp size={16} className="text-topo-2" />
          </div>
          <div>
            <h3 className="font-body text-base font-bold text-ink">Data Growth Trends</h3>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">
              {periodLabel ? `${periodLabel} · ` : ''}Updated: {formatLocalTime(new Date())}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ranges.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setActiveRange(r)}
              className={`px-3 py-1 rounded-lg font-mono text-[10px] font-bold tracking-wider transition-all ${
                activeRange === r
                  ? 'bg-topo-4 text-white'
                  : 'bg-base border border-contour text-ink-muted hover:text-ink'
              }`}
            >
              {r}
            </button>
          ))}
          <button type="button" onClick={() => onRefetch?.()} className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors" aria-label="Refresh growth trends">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div className="px-2 pb-2">
        {loading && !hasData && <div className="py-12 text-center font-mono text-[10px] text-ink-faint">Loading growth trends…</div>}
        {!loading && !hasData && <div className="py-12 text-center font-mono text-[10px] text-ink-faint">No trend data. Ensure storage API is running.</div>}
        {hasData && (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {/* Y-axis */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const val = frac * maxVal;
            const y = H - P - (frac * (H - P * 2));
            return (
              <g key={frac}>
                <line x1={P} y1={y} x2={W - P} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                <text x={P - 4} y={y + 3} textAnchor="end" className="fill-ink-faint" style={{ fontSize: '8px', fontFamily: 'Space Mono' }}>
                  {val >= 1e6 ? `${(val / 1e6).toFixed(1)}M` : val >= 1e3 ? `${(val / 1e3).toFixed(0)}k` : val}
                </text>
              </g>
            );
          })}

          <defs>
            <linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7ab648" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#7ab648" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="silverArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3a7ed4" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3a7ed4" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="bronzeArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e07a3a" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#e07a3a" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <motion.path d={buildAreaPath(gold, maxVal, W, H, P)} fill="url(#goldArea)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} />
          <motion.path d={buildAreaPath(silver, maxVal, W, H, P)} fill="url(#silverArea)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} />
          <motion.path d={buildAreaPath(bronze, maxVal, W, H, P)} fill="url(#bronzeArea)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />

          <motion.polyline points={buildPolyline(gold, maxVal, W, H, P)} fill="none" stroke="#7ab648" strokeWidth="2" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.3 }} />
          <motion.polyline points={buildPolyline(silver, maxVal, W, H, P)} fill="none" stroke="#3a7ed4" strokeWidth="2" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.2 }} />
          <motion.polyline points={buildPolyline(bronze, maxVal, W, H, P)} fill="none" stroke="#e07a3a" strokeWidth="2" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.1 }} />

          {dates.length > 0 && dates.map((d, i) => {
            const divisor = dates.length > 1 ? dates.length - 1 : 1;
            const showLabel = dates.length <= 8 || i % Math.max(1, Math.floor(dates.length / 8)) === 0 || i === dates.length - 1;
            if (!showLabel) return null;
            const x = P + (i / divisor) * (W - 2 * P);
            const label = typeof d === 'string' ? (d.length >= 10 ? d.slice(5, 10) : d) : '';
            return (
              <text key={`${d}-${i}`} x={x} y={H - P + 16} textAnchor="middle" className="fill-ink-faint" style={{ fontSize: '7px', fontFamily: 'Space Mono' }}>
                {label}
              </text>
            );
          })}
        </svg>
        )}
      </div>

      {/* Legend */}
      <div className="px-5 pb-4 flex items-center justify-center gap-6">
        {[{ label: 'Bronze', color: '#e07a3a' }, { label: 'Silver', color: '#3a7ed4' }, { label: 'Gold', color: '#7ab648' }].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-[3px] rounded-full" style={{ background: l.color }} />
            <span className="font-mono text-[10px] text-ink-muted">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
