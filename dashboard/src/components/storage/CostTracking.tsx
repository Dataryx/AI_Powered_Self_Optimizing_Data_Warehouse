import { motion } from 'framer-motion';
import { DollarSign } from 'lucide-react';

function getCostFromApi(data: any): { layerCosts: { name: string; storage: string; monthly: string; yearly: string; color: string; dotColor: string }[]; totalMonthly: string } {
  const cost = data?.cost;
  if (!cost?.breakdown) {
    return {
      layerCosts: [
        { name: 'Bronze Layer', storage: '—', monthly: '$0', yearly: '~ $0', color: 'topo-bronze', dotColor: 'bg-topo-bronze' },
        { name: 'Silver Layer', storage: '—', monthly: '$0', yearly: '~ $0', color: 'topo-silver', dotColor: 'bg-topo-silver' },
        { name: 'Gold Layer', storage: '—', monthly: '$0', yearly: '~ $0', color: 'topo-gold', dotColor: 'bg-topo-gold' },
      ],
      totalMonthly: '$0.00',
    };
  }
  const breakdown = cost.breakdown;
  const total = cost.total ?? {};
  const layerCosts = [
    { name: 'Bronze Layer', ...breakdown.bronze, color: 'topo-bronze', dotColor: 'bg-topo-bronze' },
    { name: 'Silver Layer', ...breakdown.silver, color: 'topo-silver', dotColor: 'bg-topo-silver' },
    { name: 'Gold Layer', ...breakdown.gold, color: 'topo-gold', dotColor: 'bg-topo-gold' },
  ].map((l: any) => ({
    name: l.name,
    storage: l.storage_gb != null ? `${Number(l.storage_gb).toFixed(2)} GB` : '—',
    monthly: l.monthly_cost != null ? `$${Number(l.monthly_cost).toFixed(2)}` : '$0',
    yearly: l.yearly_cost != null ? `~ $${Number(l.yearly_cost).toFixed(2)}` : '~ $0',
    color: l.color,
    dotColor: l.dotColor,
  }));
  const totalMonthly = total.monthly_cost != null ? `$${Number(total.monthly_cost).toFixed(2)}` : '$0.00';
  return { layerCosts, totalMonthly };
}

interface CostTrackingProps { data?: any; loading?: boolean }

export default function CostTracking({ data, loading }: CostTrackingProps) {
  const { layerCosts, totalMonthly } = getCostFromApi(data);
  return (
    <div className="bg-surface rounded-2xl border border-contour-strong overflow-hidden h-full">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-topo-3/10 flex items-center justify-center">
            <DollarSign size={16} className="text-topo-3" />
          </div>
          <div>
            <h3 className="font-body text-base font-bold text-ink">Cost Tracking</h3>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">Updated: 6:52:23 PM</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-ink-faint">Total Monthly</span>
          <span className="font-body text-base font-bold text-topo-4">{loading && !data?.cost ? '…' : totalMonthly}</span>
        </div>
      </div>

      <div className="px-5 pb-5">
        {/* Two column: donut + bar chart */}
        <div className="grid grid-cols-2 gap-6 mb-5">
          <div>
            <h4 className="font-body text-sm font-semibold text-ink mb-3">Monthly Cost by Layer</h4>
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                {layerCosts.map((l) => (
                  <div key={l.name} className="font-mono text-[10px] text-ink-muted">
                    <span className="font-bold text-ink">{l.monthly}</span> {l.name.replace(' Layer', '')}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Layer cost cards */}
        <div className="grid grid-cols-3 gap-3">
          {layerCosts.map((l, i) => (
            <motion.div
              key={l.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 + 0.5 }}
              className="bg-base/50 rounded-xl p-3 border border-contour"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <div className={`w-2 h-2 rounded-full ${l.dotColor}`} />
                <span className={`font-body text-xs font-semibold text-${l.color}`}>{l.name}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-mono text-[9px] text-ink-faint">Storage</span>
                  <span className="font-mono text-[10px] font-bold text-ink">{l.storage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[9px] text-ink-faint">Monthly Cost</span>
                  <span className="font-mono text-[10px] font-bold text-ink">{l.monthly} <span className="text-ink-faint font-normal">/month</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[9px] text-ink-faint">Yearly Cost</span>
                  <span className="font-mono text-[10px] text-topo-5">{l.yearly}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
