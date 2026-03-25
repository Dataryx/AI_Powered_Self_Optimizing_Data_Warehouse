import { motion } from 'framer-motion';
import { Database, Table2, ShoppingCart, DollarSign, TrendingUp, Users } from 'lucide-react';
import type { DashboardData } from '../hooks/useDashboardData';

const DEFAULT_METRICS = [
  { label: 'Total Records', value: '224,161,810', icon: Database, color: '#3ecfff', change: '+2.4%' },
  { label: 'Total Tables', value: '46', icon: Table2, color: '#818cf8', change: '+0' },
  { label: 'Total Sales', value: '15,046,325', icon: ShoppingCart, color: '#34d399', change: '+5.1%' },
  { label: 'Total Revenue', value: '$399.5B', icon: DollarSign, color: '#fbbf24', change: '+3.8%' },
  { label: 'Avg Sale Value', value: '$26,553.04', icon: TrendingUp, color: '#f87171', change: '+1.2%' },
  { label: 'Total Customers', value: '150,000', icon: Users, color: '#f59e0b', change: '+4.7%' },
];

function formatRevenue(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function buildMetrics(data: DashboardData | null): typeof DEFAULT_METRICS {
  if (!data?.summary?.warehouse_summary && !data?.sales && !data?.customers) {
    return DEFAULT_METRICS;
  }
  const ws = data.summary?.warehouse_summary;
  const totalRows =
    (ws?.bronze?.estimated_rows ?? 0) + (ws?.silver?.estimated_rows ?? 0) + (ws?.gold?.estimated_rows ?? 0);
  const totalTables =
    (ws?.bronze?.table_count ?? 0) + (ws?.silver?.table_count ?? 0) + (ws?.gold?.table_count ?? 0);
  const ts = data.sales?.total_sales;
  const count = ts?.count ?? 15046325;
  const revenue = ts?.revenue ?? 399500000000;
  const avgSale = ts?.avg_sale ?? revenue / count;
  const customers = data.customers?.total_customers ?? 150000;

  return [
    { label: 'Total Records', value: totalRows ? totalRows.toLocaleString() : DEFAULT_METRICS[0].value, icon: Database, color: '#3ecfff', change: '+2.4%' },
    { label: 'Total Tables', value: totalTables ? String(totalTables) : DEFAULT_METRICS[1].value, icon: Table2, color: '#818cf8', change: '+0' },
    { label: 'Total Sales', value: count.toLocaleString(), icon: ShoppingCart, color: '#34d399', change: '+5.1%' },
    { label: 'Total Revenue', value: formatRevenue(revenue), icon: DollarSign, color: '#fbbf24', change: '+3.8%' },
    { label: 'Avg Sale Value', value: `$${avgSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: TrendingUp, color: '#f87171', change: '+1.2%' },
    { label: 'Total Customers', value: customers.toLocaleString(), icon: Users, color: '#f59e0b', change: '+4.7%' },
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
                <span className="inline-block mt-2 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: m.color, background: `${m.color}12` }}>{m.change}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
