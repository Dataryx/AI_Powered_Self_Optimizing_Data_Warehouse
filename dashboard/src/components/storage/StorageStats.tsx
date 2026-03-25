import { motion } from 'framer-motion';

const defaultStats = [
  { label: 'Total Storage', value: '0.0 GB' },
  { label: '7-day Growth Rate', value: '+0.0%' },
  { label: 'Cache Hit Rate', value: '—' },
  { label: 'Monthly Cost', value: '$0.00' },
  { label: 'Largest Table', value: '—', sub: '—' },
];

interface StorageStatsProps { data?: any; loading?: boolean }

function buildStats(data: any): typeof defaultStats {
  const u = data?.utilization?.utilization ?? data?.utilization;
  const layerSum = ([(u?.bronze?.total_bytes), (u?.silver?.total_bytes), (u?.gold?.total_bytes)].filter((x) => x != null) as number[]).reduce((a, b) => a + b, 0);
  const totalBytes = u?._total?.total_bytes ?? (layerSum || null);
  const totalGb = totalBytes != null ? totalBytes / (1024 ** 3) : null;
  let largestTable = defaultStats[4].value;
  let largestTableSize = defaultStats[4].sub;
  if (u) {
    const allTables: { name: string; size: number }[] = [];
    for (const layer of ['bronze', 'silver', 'gold']) {
      const tables = u[layer]?.tables ?? [];
      for (const t of tables) {
        const bytes = t.size_bytes ?? 0;
        allTables.push({ name: `${layer}.${t.table ?? '?'}`, size: bytes });
      }
    }
    if (allTables.length > 0) {
      const maxT = allTables.reduce((a, b) => (a.size >= b.size ? a : b));
      largestTable = maxT.name;
      largestTableSize = maxT.size >= 1024 ** 3 ? `${(maxT.size / 1024 ** 3).toFixed(2)} GB` : maxT.size >= 1024 ** 2 ? `${(maxT.size / 1024 ** 2).toFixed(0)} MB` : `${(maxT.size / 1024).toFixed(0)} KB`;
    }
  }
  const g = data?.growth?.trends ?? data?.growth;
  const growthPct = g && (g.bronze || g.silver || g.gold)
    ? [g.bronze?.growth_rate_percent, g.silver?.growth_rate_percent, g.gold?.growth_rate_percent].filter((x: number) => x != null).reduce((a: number, b: number) => a + b, 0) / 3
    : null;
  const c = data?.cache?.overall ?? data?.cache;
  const hitRate = c?.hit_rate;
  const costTotal = data?.cost?.total ?? data?.cost;
  const monthlyCost = costTotal?.monthly_cost ?? costTotal?.monthly;
  return [
    { label: 'Total Storage', value: totalGb != null ? `${Number(totalGb).toFixed(1)} GB` : defaultStats[0].value },
    { label: '7-day Growth Rate', value: growthPct != null ? `+${Number(growthPct).toFixed(2)}%` : defaultStats[1].value },
    { label: 'Cache Hit Rate', value: hitRate != null ? `${Number(hitRate).toFixed(1)}%` : defaultStats[2].value },
    { label: 'Monthly Cost', value: monthlyCost != null ? `$${Number(monthlyCost).toFixed(2)}` : defaultStats[3].value },
    { label: 'Largest Table', value: largestTable, sub: largestTableSize },
  ];
}

export default function StorageStats({ data, loading }: StorageStatsProps) {
  const hasData = data?.utilization || data?.growth || data?.cache || data?.cost;
  const stats = hasData ? buildStats(data) : defaultStats;
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-contour rounded-2xl overflow-hidden border border-contour-strong">
      {(loading && !data?.utilization)
        ? [1, 2, 3, 4, 5].map((i) => <div key={i} className="bg-surface p-4 h-16 animate-pulse" />)
        : stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-surface p-4"
            >
              <span className="font-mono text-[9px] text-ink-faint tracking-widest uppercase block mb-1.5">{s.label}</span>
              <span className="font-body text-xl font-bold text-ink block">{s.value}</span>
              {s.sub && <span className="font-mono text-[10px] text-ink-faint">{s.sub}</span>}
            </motion.div>
          ))}
    </div>
  );
}
