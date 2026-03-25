import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Minimize2 } from 'lucide-react';

const LAYER_COLORS: Record<string, string> = { bronze: '#e07a3a', silver: '#3a7ed4', gold: '#7ab648' };
const LAYERS = ['bronze', 'silver', 'gold'] as const;
type LayerKey = (typeof LAYERS)[number];
const PAGE_SIZE = 4;

function getCompressionFromApi(data: any): {
  barData: { label: string; value: number; color: string }[];
  layerData: Record<LayerKey, { tables: { name: string; ratio: string; pct: number }[]; avgRatio: string }>;
} {
  const comp = data?.compression?.compression ?? data?.compression;
  const emptyLayer = { tables: [], avgRatio: '—' };
  if (!comp) {
    return {
      barData: [],
      layerData: { bronze: emptyLayer, silver: emptyLayer, gold: emptyLayer },
    };
  }
  const barData = LAYERS.map((layer) => {
    const L = layer.toUpperCase();
    const meta = comp[layer];
    const avg = meta?.average_compression_ratio ?? 1;
    return { label: L, value: Number(avg) || 1, color: LAYER_COLORS[layer] ?? '#5a6a8a' };
  });
  const layerData: Record<LayerKey, { tables: { name: string; ratio: string; pct: number }[]; avgRatio: string }> = {
    bronze: emptyLayer,
    silver: emptyLayer,
    gold: emptyLayer,
  };
  for (const layer of LAYERS) {
    const meta = comp[layer];
    const tableList = meta?.tables ?? [];
    layerData[layer] = {
      tables: tableList.map((t: any) => ({
        name: t.table ?? '?',
        ratio: `${Number(t.compression_ratio || 1).toFixed(2)}x`,
        pct: Math.min(100, Number(t.compression_percentage) || 0),
      })),
      avgRatio: meta?.average_compression_ratio != null ? `${Number(meta.average_compression_ratio).toFixed(2)}x` : '—',
    };
  }
  return { barData, layerData };
}

interface CompressionStatsProps { data?: any; loading?: boolean }

export default function CompressionStats({ data, loading }: CompressionStatsProps) {
  const { barData, layerData } = getCompressionFromApi(data);
  const [selectedLayer, setSelectedLayer] = useState<LayerKey>('bronze');
  const [page, setPage] = useState(1);

  const { tables, avgRatio } = layerData[selectedLayer];
  const tableCount = tables.length;
  const totalPages = tableCount > 0 ? Math.max(1, Math.ceil(tableCount / PAGE_SIZE)) : 1;
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageTables = tables.slice(startIndex, startIndex + PAGE_SIZE);
  const layerLabel = selectedLayer.toUpperCase();
  const layerColor = LAYER_COLORS[selectedLayer] ?? '#5a6a8a';

  // Reset to page 1 when switching layers
  useEffect(() => {
    setPage(1);
  }, [selectedLayer]);

  // Keep page in bounds when data shrinks; only skip during loading so we don't clamp on temporary empty state
  useEffect(() => {
    if (loading) return;
    if (page > totalPages && totalPages >= 1) setPage(totalPages);
  }, [totalPages, page, loading]);

  const maxVal = Math.max(2, ...barData.map((d) => d.value));
  return (
    <div className="bg-surface rounded-2xl border border-contour-strong overflow-hidden h-full">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-topo-6/10 flex items-center justify-center">
            <Minimize2 size={16} className="text-topo-6" />
          </div>
          <div>
            <h3 className="font-body text-base font-bold text-ink">Compression Statistics</h3>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">Updated: 6:52:23 PM</p>
          </div>
        </div>
        <button className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="px-5 pb-5">
        {/* Bar chart */}
        <div className="flex items-end justify-center gap-8 h-32 mb-4">
          {barData.map((d, i) => (
            <div key={d.label} className="flex flex-col items-center gap-1">
              <span className="font-mono text-[10px] text-ink-muted font-bold">{d.value.toFixed(1)}</span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.value / maxVal) * 80}px` }}
                transition={{ delay: i * 0.1 + 0.3, duration: 0.5 }}
                className="w-14 rounded-t-lg"
                style={{ background: d.color, opacity: 0.8 }}
              />
              <span className="font-mono text-[8px] text-ink-faint tracking-wider">{d.label}</span>
            </div>
          ))}
        </div>

        {/* Layer tabs */}
        <div className="flex gap-1 mb-4">
          {LAYERS.map((layerKey) => (
            <button
              key={layerKey}
              type="button"
              onClick={() => setSelectedLayer(layerKey)}
              className={`px-3 py-1 rounded-lg font-mono text-[9px] font-bold tracking-wider transition-all ${
                selectedLayer === layerKey
                  ? 'text-white'
                  : 'bg-base border border-contour text-ink-muted hover:text-ink'
              }`}
              style={selectedLayer === layerKey ? { backgroundColor: LAYER_COLORS[layerKey] } : undefined}
            >
              {layerKey.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="mb-3">
          <h4 className="font-body text-sm font-semibold" style={{ color: layerColor }}>{layerLabel} Layer</h4>
          <p className="font-mono text-[10px] text-ink-faint">Avg Compression: <span className="font-bold text-topo-5">{avgRatio}</span></p>
          <p className="font-mono text-[9px] text-ink-faint">{tableCount} tables</p>
        </div>

        {loading && !barData.length && <p className="font-mono text-[10px] text-ink-faint">Loading…</p>}
        <div className="space-y-3">
          {pageTables.map((t, i) => (
            <motion.div
              key={`${t.name}-${startIndex + i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 + 0.4 }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[11px] text-ink-soft font-medium truncate mr-2">{t.name}</span>
                <span className="font-mono text-[10px] text-ink-muted shrink-0">{t.ratio}</span>
              </div>
              <div className="h-1.5 bg-base rounded-full overflow-hidden">
                <div className="h-full bg-topo-5 rounded-full" style={{ width: `${t.pct}%`, opacity: 0.6 }} />
              </div>
              <span className="font-mono text-[8px] text-ink-faint">{t.pct}%</span>
            </motion.div>
          ))}
        </div>

        {tableCount > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[10px] transition-colors ${
                  n === currentPage ? 'bg-topo-5 text-white' : 'text-ink-faint hover:bg-base hover:text-ink'
                }`}
              >
                {n}
              </button>
            ))}
            <span className="font-mono text-[9px] text-ink-faint ml-2">Page {currentPage} of {totalPages}</span>
          </div>
        )}
      </div>
    </div>
  );
}
