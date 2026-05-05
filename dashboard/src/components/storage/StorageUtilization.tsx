import { motion } from 'framer-motion';
import { HardDrive } from 'lucide-react';
import { formatLocalTime } from '../../utils/time';

const LAYER_COLORS: Record<string, string> = { bronze: '#e07a3a', silver: '#3a7ed4', gold: '#7ab648' };
const LAYER_LABELS: Record<string, string> = { BRONZE: 'BRONZE', SILVER: 'SILVER', GOLD: 'GOLD' };
const layerColors: Record<string, { bg: string; text: string; border: string }> = {
  BRONZE: { bg: 'bg-topo-bronze', text: 'text-topo-bronze', border: 'border-topo-bronze/20' },
  SILVER: { bg: 'bg-topo-silver', text: 'text-topo-silver', border: 'border-topo-silver/20' },
  GOLD: { bg: 'bg-topo-gold', text: 'text-topo-gold', border: 'border-topo-gold/20' },
};

function buildUtilizationFromApi(utilization: any): {
  pieData: { label: string; pct: number; color: string }[];
  topTables: { name: string; size: number; color: string }[];
  layerTables: Record<string, { total: string; count: string; tables: { name: string; size: string }[] }>;
  totalDisplay: string;
} {
  const u = utilization?.utilization ?? utilization;
  if (!u || !u._total) {
    return {
      pieData: [
        { label: 'BRONZE', pct: 33.3, color: LAYER_COLORS.bronze },
        { label: 'SILVER', pct: 33.3, color: LAYER_COLORS.silver },
        { label: 'GOLD', pct: 33.4, color: LAYER_COLORS.gold },
      ],
      topTables: [],
      layerTables: { BRONZE: { total: '0 MB', count: '0 tables', tables: [] }, SILVER: { total: '0 MB', count: '0 tables', tables: [] }, GOLD: { total: '0 MB', count: '0 tables', tables: [] } },
      totalDisplay: '0 MB',
    };
  }
  const totalBytes = Number(u._total.total_bytes) || 0;
  const totalDisplay = u._total.total_size ?? (totalBytes / (1024 ** 2)).toFixed(0) + ' MB';
  const pieData: { label: string; pct: number; color: string }[] = [];
  const allTables: { name: string; size: number; color: string }[] = [];
  const layerTables: Record<string, { total: string; count: string; tables: { name: string; size: string }[] }> = { BRONZE: { total: '0 MB', count: '0 tables', tables: [] }, SILVER: { total: '0 MB', count: '0 tables', tables: [] }, GOLD: { total: '0 MB', count: '0 tables', tables: [] } };
  for (const layer of ['bronze', 'silver', 'gold']) {
    const L = layer.toUpperCase() as keyof typeof layerTables;
    const meta = u[layer];
    const bytes = meta?.total_bytes ?? 0;
    const pct = totalBytes > 0 ? (bytes / totalBytes) * 100 : 33.33;
    pieData.push({ label: LAYER_LABELS[L] ?? L, pct: Math.round(pct * 10) / 10, color: LAYER_COLORS[layer] ?? '#5a6a8a' });
    const tables = meta?.tables ?? [];
    layerTables[L] = {
      total: meta?.total_size ?? '0 MB',
      count: `${tables.length} tables`,
      tables: tables.slice(0, 6).map((t: any) => ({ name: t.table ?? '?', size: t.total_size ?? '0 B' })),
    };
    for (const t of tables) {
      allTables.push({ name: `${layer}.${t.table ?? '?'}`, size: Number(t.size_bytes) || 0, color: LAYER_COLORS[layer] ?? '#5a6a8a' });
    }
  }
  allTables.sort((a, b) => b.size - a.size);
  const topTables = allTables.slice(0, 10);
  return { pieData, topTables, layerTables, totalDisplay };
}

function PieChart({ segments }: { segments: { label: string; pct: number; color: string }[] }) {
  let cumulative = 0;
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const innerR = 42;

  const pathSegments = segments.map((d) => {
    const startAngle = cumulative * 3.6 * (Math.PI / 180);
    cumulative += d.pct;
    const endAngle = cumulative * 3.6 * (Math.PI / 180);
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle - Math.PI / 2);
    const y1 = cy + r * Math.sin(startAngle - Math.PI / 2);
    const x2 = cx + r * Math.cos(endAngle - Math.PI / 2);
    const y2 = cy + r * Math.sin(endAngle - Math.PI / 2);
    const ix1 = cx + innerR * Math.cos(endAngle - Math.PI / 2);
    const iy1 = cy + innerR * Math.sin(endAngle - Math.PI / 2);
    const ix2 = cx + innerR * Math.cos(startAngle - Math.PI / 2);
    const iy2 = cy + innerR * Math.sin(startAngle - Math.PI / 2);
    const path = `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} L${ix1},${iy1} A${innerR},${innerR} 0 ${largeArc} 0 ${ix2},${iy2} Z`;
    return { ...d, path };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {pathSegments.map((seg, i) => (
        <motion.path
          key={i}
          d={seg.path}
          fill={seg.color}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.85 }}
          transition={{ delay: i * 0.15 + 0.3 }}
          className="hover:opacity-100 transition-opacity cursor-pointer"
        />
      ))}
    </svg>
  );
}

interface StorageUtilizationProps {
  data?: any;
  loading?: boolean;
}

export default function StorageUtilization({ data, loading }: StorageUtilizationProps) {
  const { pieData, topTables, layerTables, totalDisplay } = buildUtilizationFromApi(data?.utilization);
  const maxSize = topTables.length > 0 ? Math.max(...topTables.map((t) => t.size), 1) : 1;
  return (
    <div className="bg-surface rounded-2xl border border-contour-strong overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-contour">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-topo-5/10 flex items-center justify-center">
            <HardDrive size={16} className="text-topo-5" />
          </div>
          <div>
            <h3 className="font-body text-base font-bold text-ink">Storage Utilization</h3>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">Updated: {formatLocalTime(new Date())}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-ink-muted">Total: <span className="font-bold text-topo-5">{totalDisplay}</span></span>
        </div>
      </div>

      {/* Distribution + Top Tables */}
      <div className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h4 className="font-body text-sm font-semibold text-ink mb-4">Distribution by Layer</h4>
            <div className="flex items-center justify-center gap-6">
              <PieChart segments={pieData} />
              <div className="space-y-2">
                {pieData.map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
                    <span className="font-mono text-[11px] text-ink-soft">{d.label}: <span className="font-bold text-ink">{d.pct}%</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-body text-sm font-semibold text-ink mb-4">Top 10 Tables by Size</h4>
            {loading && !topTables.length && <p className="font-mono text-[10px] text-ink-faint">Loading…</p>}
            {!topTables.length && !loading && <p className="font-mono text-[10px] text-ink-faint">No table data</p>}
            <div className="space-y-1.5">
              {topTables.map((t, i) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 + 0.3 }}
                  className="flex items-center gap-2 group"
                >
                  <span className="font-mono text-[9px] text-ink-muted w-[130px] text-right truncate flex-shrink-0">{t.name}</span>
                  <div className="flex-1 h-3.5 bg-base rounded-sm overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(t.size / maxSize) * 100}%` }}
                      transition={{ delay: i * 0.04 + 0.5, duration: 0.5, ease: 'easeOut' }}
                      className="h-full rounded-sm"
                      style={{ background: t.color, opacity: 0.8 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Layer breakdown cards */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(layerTables).map(([layer, layerData], li) => {
            const c = layerColors[layer as keyof typeof layerColors] ?? { bg: '', text: 'text-ink', border: 'border-contour' };
            return (
              <motion.div
                key={layer}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: li * 0.1 + 0.4 }}
                className={`rounded-xl border ${c.border} overflow-hidden`}
              >
                <div className="px-4 py-3 bg-base/50 border-b border-contour">
                  <div className="flex items-center justify-between">
                    <span className={`font-body text-sm font-bold ${c.text}`}>{layer} Layer</span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-body text-lg font-bold text-ink">{layerData.total}</span>
                    <span className="font-mono text-[9px] text-ink-faint">{layerData.count}</span>
                  </div>
                </div>
                <div className="px-4 py-2">
                  {layerData.tables.map((t, ti) => (
                    <div key={ti} className="flex items-center justify-between py-1.5 border-b border-contour last:border-b-0">
                      <span className="font-mono text-[11px] text-ink-soft">{t.name}</span>
                      <span className={`font-mono text-[11px] font-bold ${c.text}`}>{t.size}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
