import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';
import type { DashboardData } from '../hooks/useDashboardData';

function normalizeChartData(data: DashboardData | null): Array<{ date: string; sales: number; revenue: number }> {
  const raw = data?.sales?.daily_sales;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  // Backend returns `daily_sales` in descending date order; we sort ascending so
  // the chart shows the latest N points in chronological order.
  const sortedAsc = [...raw].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Show *all* historical points returned by the API (no hardcoded 11-day window).
  return sortedAsc.map((d) => {
    const dateObj = new Date(d.date);
    const date = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const sales = d.count ?? d.sales ?? 0;
    const revenue = d.revenue ?? 0;
    return { date, sales, revenue };
  });
}

function buildPath(values: number[], max: number, w: number, h: number, pad: number): string {
  const step = (w - pad * 2) / (values.length - 1);
  return values.map((v, i) => { const x = pad + i * step; const y = h - pad - ((v / max) * (h - pad * 2)); return `${i === 0 ? 'M' : 'L'}${x},${y}`; }).join(' ');
}
function buildArea(values: number[], max: number, w: number, h: number, pad: number): string {
  const step = (w - pad * 2) / (values.length - 1);
  const line = values.map((v, i) => { const x = pad + i * step; const y = h - pad - ((v / max) * (h - pad * 2)); return `${i === 0 ? 'M' : 'L'}${x},${y}`; }).join(' ');
  const lastX = pad + (values.length - 1) * step;
  return `${line} L${lastX},${h - pad} L${pad},${h - pad} Z`;
}

interface SalesTrendProps {
  data?: DashboardData | null;
  loading?: boolean;
}

export default function SalesTrend({ data = null, loading = false }: SalesTrendProps) {
  const [hover, setHover] = useState<number | null>(null);
  const chartData = useMemo(() => normalizeChartData(data ?? null), [data]);
  const hasChartData = chartData.length >= 2;
  const maxSales = hasChartData ? Math.max(...chartData.map((d) => d.sales), 1) : 1;
  const maxRevenue = hasChartData ? Math.max(...chartData.map((d) => d.revenue), 1) : 1;

  const H = 280;
  const P = 40;
  // Keep a fixed viewBox width so the chart always renders inside the card.
  // With many points, the horizontal step becomes small (dense plot), but UI stays visible.
  const W = 700;
  const salesPath = hasChartData ? buildPath(chartData.map((d) => d.sales), maxSales, W, H, P) : '';
  const revPath = hasChartData ? buildPath(chartData.map((d) => d.revenue), maxRevenue, W, H, P) : '';
  const salesArea = hasChartData ? buildArea(chartData.map((d) => d.sales), maxSales, W, H, P) : '';
  const step = hasChartData ? (W - P * 2) / (chartData.length - 1) : 1;

  const peakSales = hasChartData
    ? chartData.reduce((best, d) => (d.sales > best.sales ? d : best), chartData[0])
    : { sales: 0, date: '' };
  const peakRevenue = hasChartData
    ? chartData.reduce((best, d) => (d.revenue > best.revenue ? d : best), chartData[0])
    : { revenue: 0, date: '' };
  const avgDaily = hasChartData ? Math.round(chartData.reduce((a, b) => a + b.sales, 0) / chartData.length) : 0;

  return (
    <div className="bg-[#111628] rounded-2xl border border-[#1e2540] overflow-hidden h-full">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-0.5">
            <span className="font-mono text-[9px] text-[#3a4a6a] tracking-[0.3em] uppercase">Section 03</span>
            <span className="font-body text-sm font-semibold text-[#a0b0cc]">Sales Trend</span>
          </div>
          <p className="font-mono text-[10px] text-[#4a5a7a] tracking-wider">Daily sales count and revenue — last 2 months to today</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5"><div className="w-3 h-[3px] rounded-full bg-[#f87171]" /><span className="font-mono text-[10px] text-[#5a6a8a]">Sales</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-[3px] rounded-full bg-[#818cf8]" /><span className="font-mono text-[10px] text-[#5a6a8a]">Revenue</span></div>
        </div>
      </div>
      {loading && !data?.sales?.daily_sales?.length && (
        <div className="px-2 h-[280px] flex items-center justify-center">
          <div className="w-full h-48 bg-[#0c0f1a] rounded-xl animate-pulse" />
        </div>
      )}
      {(!loading && !hasChartData) && (
        <div className="px-5 pb-6 pt-2">
          <div className="py-10 text-center font-body text-sm text-[#5a6a8a]">
            No real sales trend data yet. Run ETL and generate enough sales in `gold.fact_sales`.
          </div>
        </div>
      )}
      {hasChartData && (
        <>
          <div className="px-2">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}>
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => { const y = H - P - pct * (H - P * 2); return (<g key={pct}><line x1={P} y1={y} x2={W - P} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" /><text x={P - 4} y={y + 3} textAnchor="end" fill="#3a4a6a" style={{ fontSize: '9px', fontFamily: 'Space Mono' }}>{Math.round(maxSales * pct / 1000)}k</text></g>); })}
              <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f87171" stopOpacity="0.15" /><stop offset="100%" stopColor="#f87171" stopOpacity="0.01" /></linearGradient></defs>
              <path d={salesArea} fill="url(#salesFill)" />
              <motion.path d={salesPath} fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
              <motion.path d={revPath} fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 }} />
              {chartData.map((d, i) => { const x = P + i * step; const ySales = H - P - ((d.sales / maxSales) * (H - P * 2)); return (<g key={i} onMouseEnter={() => setHover(i)}><rect x={x - step / 2} y={0} width={step} height={H} fill="transparent" />{hover === i && <line x1={x} y1={P} x2={x} y2={H - P} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />}<circle cx={x} cy={ySales} r={hover === i ? 5 : 3} fill="#f87171" stroke="#111628" strokeWidth="2" /><text x={x} y={H - P + 18} textAnchor="middle" fill="#4a5a7a" style={{ fontSize: '9px', fontFamily: 'Space Mono' }}>{d.date.split(' ')[1]}</text></g>); })}
              {hover !== null && (() => { const d = chartData[hover]; const x = Math.min(Math.max(P + hover * step, 90), W - 90); return (<g><rect x={x - 70} y={8} width={140} height={52} rx={8} fill="#0c0f1a" fillOpacity="0.95" stroke="#1e2540" strokeWidth="1" /><text x={x} y={26} textAnchor="middle" fill="#e0e8f5" style={{ fontSize: '11px', fontFamily: 'Outfit', fontWeight: 600 }}>{d.date}</text><text x={x - 30} y={44} textAnchor="middle" fill="#f87171" style={{ fontSize: '10px', fontFamily: 'Space Mono' }}>{d.sales.toLocaleString()}</text><text x={x + 30} y={44} textAnchor="middle" fill="#818cf8" style={{ fontSize: '10px', fontFamily: 'Space Mono' }}>${(d.revenue / 1000).toFixed(0)}K</text></g>); })()}
            </svg>
          </div>
          <div className="px-5 py-3 border-t border-[#1e2540] flex gap-6">
            <div><span className="font-mono text-[9px] text-[#3a4a6a] tracking-widest uppercase">Peak Sales</span><p className="font-body text-lg font-bold text-[#e0e8f5]">{peakSales.sales.toLocaleString()} <span className="font-mono text-[10px] text-[#4a5a7a]">{peakSales.date}</span></p></div>
            <div><span className="font-mono text-[9px] text-[#3a4a6a] tracking-widest uppercase">Peak Revenue</span><p className="font-body text-lg font-bold text-[#818cf8]">${peakRevenue.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="font-mono text-[10px] text-[#4a5a7a]">{peakRevenue.date}</span></p></div>
            <div><span className="font-mono text-[9px] text-[#3a4a6a] tracking-widest uppercase">Avg Daily</span><p className="font-body text-lg font-bold text-[#e0e8f5]">{avgDaily.toLocaleString()}</p></div>
          </div>
        </>
      )}
    </div>
  );
}
