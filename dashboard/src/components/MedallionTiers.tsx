import { motion } from 'framer-motion';
import { Layers, Database, Crown, ArrowRight } from 'lucide-react';
import type { DashboardData } from '../hooks/useDashboardData';

const DEFAULT_TIERS = [
  { name: 'Bronze', icon: Layers, tables: 16, rows: '52,571,979', rowsNum: 52571979, desc: 'Raw ingestion layer', color: '#e07a3a', elevation: '1,200m' },
  { name: 'Silver', icon: Database, tables: 16, rows: '99,757,794', rowsNum: 99757794, desc: 'Cleaned & conformed', color: '#8a9aaa', elevation: '2,800m' },
  { name: 'Gold', icon: Crown, tables: 14, rows: '72,832,037', rowsNum: 72832037, desc: 'Business-ready analytics', color: '#c4a43a', elevation: '4,200m' },
];

function buildTiers(data: DashboardData | null): typeof DEFAULT_TIERS {
  const ws = data?.summary?.warehouse_summary;
  if (!ws) return DEFAULT_TIERS;

  const bronze = ws.bronze ?? { table_count: 16, estimated_rows: 52571979 };
  const silver = ws.silver ?? { table_count: 16, estimated_rows: 99757794 };
  const gold = ws.gold ?? { table_count: 14, estimated_rows: 72832037 };
  const total = bronze.estimated_rows + silver.estimated_rows + gold.estimated_rows;

  return [
    { name: 'Bronze', icon: Layers, tables: bronze.table_count, rows: bronze.estimated_rows.toLocaleString(), rowsNum: bronze.estimated_rows, desc: 'Raw ingestion layer', color: '#e07a3a', elevation: '1,200m' },
    { name: 'Silver', icon: Database, tables: silver.table_count, rows: silver.estimated_rows.toLocaleString(), rowsNum: silver.estimated_rows, desc: 'Cleaned & conformed', color: '#8a9aaa', elevation: '2,800m' },
    { name: 'Gold', icon: Crown, tables: gold.table_count, rows: gold.estimated_rows.toLocaleString(), rowsNum: gold.estimated_rows, desc: 'Business-ready analytics', color: '#c4a43a', elevation: '4,200m' },
  ];
}

interface MedallionTiersProps {
  data?: DashboardData | null;
  loading?: boolean;
}

export default function MedallionTiers({ data = null, loading = false }: MedallionTiersProps) {
  const tiers = buildTiers(data ?? null);
  const total = tiers.reduce((s, t) => s + t.rowsNum, 0);

  return (
    <section className="mt-10">
      <div className="flex items-center gap-3 mb-5">
        <span className="font-mono text-[9px] text-[#3a4a6a] tracking-[0.3em] uppercase">Section 02</span>
        <div className="flex-1 h-px bg-[#1e2540]" />
        <span className="font-body text-sm font-semibold text-[#5a6a8a]">Medallion Architecture</span>
        <div className="flex-1 h-px bg-[#1e2540]" />
      </div>
      {loading && !data?.summary?.warehouse_summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#111628] rounded-2xl p-5 border border-[#1e2540] h-64 animate-pulse" />
          ))}
        </div>
      )}
      {(!loading || data?.summary?.warehouse_summary) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          <div className="hidden md:flex absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-8 h-8 rounded-full bg-[#0c0f1a] border border-[#1e2540] flex items-center justify-center"><ArrowRight size={14} className="text-[#4a5a7a]" /></div>
          </div>
          <div className="hidden md:flex absolute top-1/2 left-2/3 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-8 h-8 rounded-full bg-[#0c0f1a] border border-[#1e2540] flex items-center justify-center"><ArrowRight size={14} className="text-[#4a5a7a]" /></div>
          </div>
          {tiers.map((tier, i) => {
            const Icon = tier.icon;
            const pct = total > 0 ? ((tier.rowsNum / total) * 100).toFixed(1) : '0';
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 + 0.15 }}
                className="bg-[#111628] rounded-2xl p-5 border border-[#1e2540] relative overflow-hidden group hover:border-[#2a3a60] transition-all duration-300"
              >
                <div className="absolute top-0 left-0 w-full h-[2px] opacity-50" style={{ background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)` }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${tier.color}15` }}>
                      <Icon size={18} style={{ color: tier.color }} />
                    </div>
                    <span className="font-mono text-[9px] text-[#3a4a6a] tracking-widest">ELEV {tier.elevation}</span>
                  </div>
                  <h3 className="font-body text-2xl font-bold mb-0.5" style={{ color: tier.color }}>{tier.name}</h3>
                  <p className="font-mono text-[10px] text-[#4a5a7a] tracking-wider mb-5">{tier.desc}</p>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-[#0c0f1a] rounded-xl p-3">
                      <span className="font-mono text-[9px] text-[#3a4a6a] tracking-widest uppercase block mb-1">Tables</span>
                      <span className="font-body text-2xl font-bold text-[#e0e8f5]">{tier.tables}</span>
                    </div>
                    <div className="bg-[#0c0f1a] rounded-xl p-3">
                      <span className="font-mono text-[9px] text-[#3a4a6a] tracking-widest uppercase block mb-1">Rows</span>
                      <span className="font-body text-sm font-bold text-[#e0e8f5]">{tier.rows}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-mono text-[9px] text-[#3a4a6a]">Distribution</span>
                      <span className="font-mono text-[10px] text-[#a0b0cc] font-bold">{pct}%</span>
                    </div>
                    <div className="h-2 bg-[#0c0f1a] rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.12 + 0.5, duration: 0.8 }} className="h-full rounded-full" style={{ background: tier.color, opacity: 0.7 }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
