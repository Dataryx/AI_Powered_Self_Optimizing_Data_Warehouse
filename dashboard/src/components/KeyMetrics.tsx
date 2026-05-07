import { motion } from 'framer-motion';
import { Database, Table2, ShoppingCart, DollarSign, TrendingUp, Users } from 'lucide-react';
import type { DashboardData } from '../hooks/useDashboardData';

type MetricCard = {
  label: string;
  value: string;
  icon: typeof Database;
  color: string;
  change?: string | null;
};

function fmtInt(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString();
}

function formatRevenue(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function buildMetrics(data: DashboardData | null): MetricCard[] {
  const ws = data?.summary?.warehouse_summary;
  const hasWarehouseRows = Boolean(ws?.bronze || ws?.silver || ws?.gold);
  const totalRows = hasWarehouseRows
    ? (ws?.bronze?.estimated_rows ?? 0) + (ws?.silver?.estimated_rows ?? 0) + (ws?.gold?.estimated_rows ?? 0)
    : null;
  const totalTables = hasWarehouseRows
    ? (ws?.bronze?.table_count ?? 0) + (ws?.silver?.table_count ?? 0) + (ws?.gold?.table_count ?? 0)
    : null;
  const ts = data?.sales?.total_sales;
  const count = typeof ts?.count === 'number' && Number.isFinite(ts.count) ? ts.count : null;
  const revenue = typeof ts?.revenue === 'number' && Number.isFinite(ts.revenue) ? ts.revenue : null;
  const avgSale =
    typeof ts?.avg_sale === 'number' && Number.isFinite(ts.avg_sale)
      ? ts.avg_sale
      : count != null && count > 0 && revenue != null
        ? revenue / count
        : null;
  const customersRaw = data?.customers?.total_customers;
  const customers =
    typeof customersRaw === 'number' && Number.isFinite(customersRaw) ? customersRaw : null;

  return [
    { label: 'Total Records', value: fmtInt(totalRows), icon: Database, color: '#3ecfff', change: null },
    { label: 'Total Tables', value: fmtInt(totalTables), icon: Table2, color: '#818cf8', change: null },
    { label: 'Total Sales', value: fmtInt(count), icon: ShoppingCart, color: '#34d399', change: null },
    { label: 'Total Revenue', value: revenue != null ? formatRevenue(revenue) : '—', icon: DollarSign, color: '#fbbf24', change: null },
    {
      label: 'Avg Sale Value',
      value:
        avgSale != null
          ? `$${avgSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '—',
      icon: TrendingUp,
      color: '#f87171',
      change: null,
    },
    { label: 'Total Customers', value: fmtInt(customers), icon: Users, color: '#f59e0b', change: null },
  ];
}

interface KeyMetricsProps {
  data?: DashboardData | null;
  loading?: boolean;
}

export default function KeyMetrics({ data = null, loading = false }: KeyMetricsProps) {
  const metrics = buildMetrics(data ?? null);

  return (
    <section>
      <div className="flex items-center gap-3 mb-5">
        <span className="font-mono text-[9px] text-[#3a4a6a] tracking-[0.3em] uppercase">Section 01</span>
        <div className="flex-1 h-px bg-[#1e2540]" />
        <span className="font-body text-sm font-semibold text-[#5a6a8a]">Key Statistics</span>
        <div className="flex-1 h-px bg-[#1e2540]" />
      </div>
      {loading && !data?.summary && !data?.sales && !data?.customers && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-[#111628] rounded-2xl p-4 border border-[#1e2540] h-[100px] animate-pulse" />
          ))}
        </div>
      )}
      {(!loading || data?.summary || data?.sales || data?.customers) && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {metrics.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 + 0.1 }}
                className="relative bg-[#111628] rounded-2xl p-4 border border-[#1e2540] hover:border-[#2a3a60] transition-all cursor-default overflow-hidden group"
              >
                <div className="absolute top-0 left-0 w-full h-[2px] opacity-50" style={{ background: `linear-gradient(90deg, transparent, ${m.color}, transparent)` }} />
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: `${m.color}12` }}>
                  <Icon size={15} style={{ color: m.color }} />
                </div>
                <p className="font-body text-xl font-bold text-[#e0e8f5] leading-tight tracking-tight">{m.value}</p>
                <p className="font-mono text-[10px] text-[#4a5a7a] mt-1 tracking-wider uppercase">{m.label}</p>
                {m.change ? (
                  <span className="inline-block mt-2 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: m.color, background: `${m.color}12` }}>
                    {m.change}
                  </span>
                ) : null}
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
