import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { DashboardData } from '../hooks/useDashboardData';

function formatProductRevenue(rev: number): string {
  if (!Number.isFinite(rev) || rev <= 0) return '$0';
  if (rev >= 1_000_000) return `$${(rev / 1_000_000).toFixed(rev >= 10_000_000 ? 0 : 1)}M`;
  if (rev >= 10_000) return `$${Math.round(rev / 1000)}k`;
  if (rev >= 1000) return `$${(rev / 1000).toFixed(1)}k`;
  return `$${rev.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function normalizeProducts(data: DashboardData | null): Array<{ rank: number; name: string; revenue: number }> {
  const raw = data?.sales?.top_products;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const withRev = raw
    .map((p, i) => ({
      name: (p.product ?? p.product_name ?? `Product ${i + 1}`) as string,
      revenue: typeof p.revenue === 'number' ? p.revenue : Number(p.revenue) || 0,
    }))
    .filter((p) => p.revenue > 0);
  return withRev.slice(0, 10).map((p, idx) => ({
    rank: idx + 1,
    name: p.name,
    revenue: p.revenue,
  }));
}

const barColors = ['#f87171', '#f59e0b', '#fbbf24', '#34d399', '#3ecfff', '#818cf8', '#f87171', '#f59e0b', '#fbbf24', '#34d399'];

interface TopProductsProps {
  data?: DashboardData | null;
  loading?: boolean;
}

export default function TopProducts({ data = null, loading = false }: TopProductsProps) {
  const products = useMemo(() => normalizeProducts(data ?? null), [data]);
  const maxRev = products[0]?.revenue ?? 1;
  const totalRev = products.reduce((a, b) => a + b.revenue, 0);
  const hasProducts = products.length > 0;

  return (
    <div className="bg-[#111628] rounded-2xl border border-[#1e2540] overflow-hidden h-full flex flex-col">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-0.5"><span className="font-mono text-[9px] text-[#3a4a6a] tracking-[0.3em] uppercase">Section 04</span><span className="font-body text-sm font-semibold text-[#a0b0cc]">Top Products</span></div>
        <p className="font-mono text-[10px] text-[#4a5a7a] tracking-wider">Ranked by revenue — Top 10</p>
      </div>
      {loading && !data?.sales?.top_products?.length && (
        <div className="flex-1 px-5 pb-3 flex items-center justify-center">
          <div className="w-full h-48 bg-[#0c0f1a] rounded-xl animate-pulse" />
        </div>
      )}
      {!loading && !hasProducts && (
        <div className="flex-1 px-5 pb-3 flex items-center justify-center">
          <div className="py-10 text-center font-body text-sm text-[#5a6a8a]">
            No real top product data yet. Run ETL and ensure `gold.fact_sales` is populated.
          </div>
        </div>
      )}
      {(loading || hasProducts) && (
        <>
          <div className="flex-1 px-5 pb-3">
            <div className="space-y-1.5">
              {products.map((p, i) => (
                <motion.div key={`${p.name}-${i}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 + 0.2 }} className="flex items-center gap-3 group cursor-default py-1">
                  <span className={`font-mono text-[10px] w-5 text-right font-bold ${i === 0 ? 'text-[#f87171]' : i < 3 ? 'text-[#a0b0cc]' : 'text-[#3a4a6a]'}`}>{String(p.rank).padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`font-body text-xs font-medium truncate ${i === 0 ? 'text-[#f87171]' : 'text-[#c0cde0]'} group-hover:text-[#3ecfff] transition-colors`}>{p.name}</span>
                      <span className="font-mono text-[10px] text-[#a0b0cc] font-bold ml-2 flex-shrink-0">
                        {formatProductRevenue(p.revenue)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#0c0f1a] rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(p.revenue / maxRev) * 100}%` }} transition={{ delay: i * 0.04 + 0.4, duration: 0.6 }} className="h-full rounded-full" style={{ background: barColors[i % barColors.length], opacity: 0.6 }} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="px-5 py-3 border-t border-[#1e2540] flex items-center justify-between">
            <span className="font-mono text-[9px] text-[#3a4a6a] tracking-widest uppercase">Total</span>
            <span className="font-body text-base font-bold text-white">{formatProductRevenue(totalRev)}</span>
          </div>
        </>
      )}
    </div>
  );
}
