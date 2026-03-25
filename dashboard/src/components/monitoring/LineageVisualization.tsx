import { motion } from 'framer-motion';
import { Database, Table2, Repeat2, ChevronRight } from 'lucide-react';

interface NodeData {
  icon: React.ElementType;
  name: string;
  type: string;
  color: string;
}

const layers: { name: string; color: string; glow: string; border: string; bg: string; nodes: NodeData[] }[] = [
  {
    name: 'BRONZE', color: '#e07a3a', glow: 'rgba(224,122,58,0.1)', border: '#3a2a1a', bg: '#1a1510',
    nodes: [
      { icon: Database, name: 'Bronze Ingestion', type: 'source', color: '#e07a3a' },
      { icon: Table2, name: 'raw_orders', type: 'table', color: '#e07a3a' },
      { icon: Table2, name: 'raw_customers', type: 'table', color: '#e07a3a' },
      { icon: Table2, name: 'raw_products', type: 'table', color: '#e07a3a' },
    ],
  },
  {
    name: 'SILVER', color: '#8a9aaa', glow: 'rgba(138,154,170,0.08)', border: '#2a3040', bg: '#12151e',
    nodes: [
      { icon: Repeat2, name: 'Silver Transform', type: 'transform', color: '#8a9aaa' },
      { icon: Table2, name: 'orders', type: 'table', color: '#8a9aaa' },
      { icon: Table2, name: 'customers', type: 'table', color: '#8a9aaa' },
      { icon: Table2, name: 'products', type: 'table', color: '#8a9aaa' },
    ],
  },
  {
    name: 'GOLD', color: '#c4a43a', glow: 'rgba(196,164,58,0.08)', border: '#3a3520', bg: '#18160e',
    nodes: [
      { icon: Database, name: 'Gold Aggregation', type: 'aggregate', color: '#c4a43a' },
      { icon: Table2, name: 'fact_sales', type: 'table', color: '#c4a43a' },
      { icon: Table2, name: 'dim_customer', type: 'table', color: '#c4a43a' },
      { icon: Table2, name: 'dim_product', type: 'table', color: '#c4a43a' },
    ],
  },
];

interface LineageVisualizationProps { data?: any; loading?: boolean }

export default function LineageVisualization({ data, loading }: LineageVisualizationProps) {
  let globalDelay = 0;
  return (
    <div className="bg-[#111628] rounded-2xl border border-[#1e2540] overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h3 className="font-body text-base font-bold text-white">ETL Lineage Visualization</h3>
        <ChevronRight size={16} className="text-[#3a4a6a]" />
      </div>
      <div className="px-5 pb-5 space-y-3 overflow-x-auto">
        {layers.map((layer) => (
          <div key={layer.name} className="rounded-xl p-4" style={{ background: layer.bg, border: `1px solid ${layer.border}` }}>
            <span className="inline-block font-mono text-[8px] font-bold tracking-[0.25em] uppercase mb-3 px-2 py-0.5 rounded" style={{ color: layer.color, background: `${layer.color}15`, border: `1px solid ${layer.color}30` }}>
              {layer.name}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {layer.nodes.map((node, ni) => {
                const Icon = node.icon;
                globalDelay += 0.06;
                const d = globalDelay;
                return (
                  <div key={node.name} className="flex items-center gap-2">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: d }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-default hover:brightness-125 transition-all"
                      style={{ background: `${node.color}08`, borderColor: `${node.color}25` }}
                    >
                      <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: `${node.color}18` }}>
                        <Icon size={13} style={{ color: node.color }} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-body text-[11px] font-semibold text-[#c0cde0] leading-tight">{node.name}</span>
                        <span className="font-mono text-[7px] tracking-[0.2em] uppercase" style={{ color: `${node.color}99` }}>{node.type}</span>
                      </div>
                      {/* Pulse dot */}
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: node.color, boxShadow: `0 0 6px ${node.color}` }} />
                    </motion.div>
                    {ni < layer.nodes.length - 1 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d + 0.03 }} className="flex items-center">
                        <div className="w-5 h-px" style={{ background: `${node.color}40` }} />
                        <ChevronRight size={10} style={{ color: `${node.color}60` }} className="-ml-1" />
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
