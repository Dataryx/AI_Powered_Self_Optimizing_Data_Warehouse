import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Layers,
  AlertTriangle,
} from 'lucide-react';

interface DataQualityProps { data?: any; loading?: boolean; onRefetch?: () => void }

type LayerRow = {
  schema?: string;
  name?: string;
  datasets?: string;
  score?: number;
  initial?: string;
  color?: string;
  failingRules?: string | null;
  hasIssue?: boolean;
  overall_status?: string;
};

type TableMetric = {
  table?: string;
  row_count?: number;
  dead_rows?: number;
  quality_score?: number;
  status?: string;
  factors?: string[];
};

function resolveSchema(layer: LayerRow): string | undefined {
  if (layer.schema) return layer.schema;
  const n = (layer.name ?? '').toLowerCase();
  if (n.includes('bronze')) return 'bronze';
  if (n.includes('silver')) return 'silver';
  if (n.includes('gold')) return 'gold';
  return undefined;
}

function scoreHue(score: number): { bar: string; text: string } {
  if (score >= 80) return { bar: 'linear-gradient(90deg, #059669, #34d399)', text: '#34d399' };
  if (score >= 60) return { bar: 'linear-gradient(90deg, #d97706, #fbbf24)', text: '#fbbf24' };
  return { bar: 'linear-gradient(90deg, #dc2626, #f87171)', text: '#f87171' };
}

export default function DataQuality({ data, loading, onRefetch }: DataQualityProps) {
  const dq = data?.dataQuality;
  const apiLayers = Array.isArray(dq?.layers) ? (dq.layers as LayerRow[]) : [];
  const qualityMetrics = dq?.quality_metrics ?? {};
  const [openLayer, setOpenLayer] = useState<LayerRow | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  const modalTables = useMemo(() => {
    const sch = openLayer ? resolveSchema(openLayer) : undefined;
    if (!sch) return [] as TableMetric[];
    const block = qualityMetrics[sch];
    return Array.isArray(block?.tables) ? (block.tables as TableMetric[]) : [];
  }, [openLayer, qualityMetrics]);

  const hasLayers = apiLayers.length > 0;

  const overallAvg = useMemo(() => {
    if (!apiLayers.length) return null;
    const sum = apiLayers.reduce((acc, l) => acc + Number(l.score ?? 0), 0);
    return sum / apiLayers.length;
  }, [apiLayers]);

  const needsAttention = useMemo(
    () => apiLayers.filter((l) => l.hasIssue || Number(l.score) < 80).length,
    [apiLayers]
  );

  const healthyLayers = apiLayers.length - needsAttention;

  return (
    <div className="bg-[#111628] rounded-2xl border border-[#1e2540] overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#818cf812] border border-[#818cf828] flex items-center justify-center shrink-0">
            <ShieldCheck size={18} className="text-[#818cf8]" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="font-body text-base font-bold text-white tracking-tight">Data Quality</h3>
            <p className="font-mono text-[9px] text-[#4a5a7a] tracking-wider mt-0.5">
              Layer scores from row health, dead tuples, and recent ETL success
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRefetch?.()}
          className="w-8 h-8 rounded-lg bg-[#0c0f1a] border border-[#1e2540] flex items-center justify-center text-[#4a5a7a] hover:text-[#c0cde0] hover:border-[#2a3a60] transition-colors shrink-0"
          aria-label="Refresh data quality"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {hasLayers && overallAvg != null && (
        <div className="px-5 pb-4">
          <div className="flex flex-wrap gap-4 py-3 border-y border-[#1e2540]">
            <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${scoreHue(overallAvg).text}14` }}
              >
                <Layers size={14} style={{ color: scoreHue(overallAvg).text }} />
              </div>
              <div>
                <span className="font-mono text-[8px] tracking-[0.2em] uppercase block text-[#5a6a8a]">
                  Warehouse avg
                </span>
                <span
                  className="font-body text-xl font-bold tabular-nums"
                  style={{ color: scoreHue(overallAvg).text }}
                >
                  {overallAvg.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#34d39912]">
                <CheckCircle size={14} className="text-[#34d399]" />
              </div>
              <div>
                <span className="font-mono text-[8px] tracking-[0.2em] uppercase block text-[#5a6a8a]">
                  Healthy layers
                </span>
                <span className="font-body text-xl font-bold tabular-nums text-[#34d399]">{healthyLayers}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#f59e0b12]">
                <AlertTriangle size={14} className="text-[#f59e0b]" />
              </div>
              <div>
                <span className="font-mono text-[8px] tracking-[0.2em] uppercase block text-[#5a6a8a]">
                  Needs attention
                </span>
                <span
                  className="font-body text-xl font-bold tabular-nums"
                  style={{ color: needsAttention > 0 ? '#f59e0b' : '#5a6a8a' }}
                >
                  {needsAttention}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pb-5">
        {loading && !hasLayers && (
          <div className="py-10 text-center font-body text-sm text-[#5a6a8a]">Loading data quality…</div>
        )}
        {!loading && !hasLayers && (
          <div className="py-10 text-center rounded-xl border border-dashed border-[#1e2540] bg-[#0c0f1a]/40">
            <ShieldCheck size={28} className="mx-auto text-[#2a3a55] mb-2" aria-hidden />
            <p className="font-body text-sm text-[#5a6a8a]">No real data quality data yet.</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {apiLayers.map((layer, i) => {
            const score = Number(layer.score ?? 0);
            const { bar, text } = scoreHue(score);
            const accent = layer.color ?? text;
            const warn = layer.hasIssue && score < 80;
            return (
              <motion.button
                type="button"
                key={layer.schema ?? layer.name ?? i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 + 0.15 }}
                onClick={() => {
                  setOpenLayer(layer);
                  setExpandedTable(null);
                }}
                className="relative text-left rounded-xl border bg-[#0c0f1a] p-4 cursor-pointer transition-all hover:border-[#2a3a60] group overflow-hidden"
                style={{ borderColor: warn ? 'rgba(248, 113, 113, 0.35)' : '#1e2540' }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] opacity-70"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                  }}
                />
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        background: `${accent}18`,
                        borderColor: `${accent}35`,
                      }}
                    >
                      <span className="font-body text-sm font-bold" style={{ color: accent }}>
                        {layer.initial ?? layer.name?.[0] ?? '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="font-body text-sm font-semibold text-[#c0cde0] block truncate">
                        {layer.name}
                      </span>
                      <span className="font-mono text-[9px] text-[#4a5a7a] tracking-wider truncate block">
                        {layer.datasets}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    {warn ? (
                      <AlertCircle size={14} className="text-[#f87171] mb-0.5" aria-hidden />
                    ) : null}
                    <span className="font-body text-lg font-bold tabular-nums" style={{ color: text }}>
                      {score.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="h-1.5 rounded-full bg-[#111628] border border-[#1e2540] overflow-hidden mb-3">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: bar }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                    transition={{ duration: 0.5, delay: i * 0.06 + 0.2, ease: 'easeOut' }}
                  />
                </div>

                <div>
                  <span className="font-mono text-[8px] text-[#4a5a7a] tracking-[0.18em] uppercase block mb-1.5">
                    Top failing rules
                  </span>
                  {layer.hasIssue ? (
                    <div className="flex items-start gap-2 rounded-lg px-2.5 py-2 bg-[#f59e0b08] border border-[#f59e0b22]">
                      <AlertCircle size={12} className="text-[#f59e0b] shrink-0 mt-0.5" />
                      <span className="font-body text-[11px] leading-snug text-[#e8c48a]">{layer.failingRules}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[#5a6a8a]">
                      <CheckCircle size={13} className="text-[#34d399] shrink-0" />
                      <span className="font-body text-xs">No failing rules detected</span>
                    </div>
                  )}
                  <p className="font-mono text-[8px] text-[#3a4a6a] mt-2.5 group-hover:text-[#4a5a7a] transition-colors">
                    Click for per-table scores and reasons
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {openLayer && (
          <motion.div
            className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpenLayer(null)}
          >
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-2xl max-h-[min(90vh,640px)] flex flex-col rounded-2xl border border-[#1e2540] bg-[#0c0f1a] shadow-2xl shadow-black/40 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                style={{
                  background: `linear-gradient(180deg, ${openLayer.color ?? '#818cf8'}, transparent)`,
                }}
              />
              <div className="px-5 py-4 pl-6 flex items-start justify-between gap-3 border-b border-[#1e2540] shrink-0 relative">
                <div>
                  <h4 className="font-body text-lg font-bold text-white">{openLayer.name}</h4>
                  <p className="font-mono text-[10px] text-[#6a7a9a] mt-1">
                    Layer average:{' '}
                    <span className="text-[#c0cde0] font-semibold">
                      {Number(openLayer.score ?? 0).toFixed(1)}%
                    </span>
                    {openLayer.overall_status && (
                      <>
                        {' '}
                        · Status: <span className="text-[#8a9aba]">{openLayer.overall_status}</span>
                      </>
                    )}
                  </p>
                  <p className="font-mono text-[9px] text-[#4a5a7a] mt-2 leading-relaxed max-w-xl">
                    Scores use real row counts, pg_stat_user_tables dead/live tuples, and monitoring.job_runs (7d)
                    success rates, blended 55% / 45% with penalties for failures and stale jobs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenLayer(null)}
                  className="p-2 rounded-lg hover:bg-[#111628] text-[#5a6a8a] hover:text-[#c0cde0] transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 pl-6 space-y-2 min-h-0">
                {modalTables.length === 0 && (
                  <p className="font-body text-sm text-[#5a6a8a] text-center py-8">
                    No table metrics for this layer.
                  </p>
                )}
                {modalTables.map((t) => {
                  const sch = resolveSchema(openLayer);
                  const key = `${sch ?? '?'}.${t.table}`;
                  const isOpen = expandedTable === key;
                  const score = Number(t.quality_score ?? 0);
                  const factors = Array.isArray(t.factors) ? t.factors : [];
                  const chip = scoreHue(score);
                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-[#1e2540] bg-[#111628]/80 overflow-hidden hover:border-[#252b45] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedTable(isOpen ? null : key)}
                        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[#0c0f1a]/60 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isOpen ? (
                            <ChevronDown size={14} className="text-[#5a6a8a] shrink-0" />
                          ) : (
                            <ChevronRight size={14} className="text-[#5a6a8a] shrink-0" />
                          )}
                          <span className="font-mono text-sm font-semibold text-[#c0cde0] truncate">
                            {t.table}
                          </span>
                          <span
                            className="font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 border"
                            style={{
                              color: chip.text,
                              background: `${chip.text}12`,
                              borderColor: `${chip.text}30`,
                            }}
                          >
                            {t.status ?? '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="hidden sm:block w-16 h-1 rounded-full bg-[#1e2540] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(100, score)}%`, background: chip.bar }}
                            />
                          </div>
                          <span className="font-body text-sm font-bold tabular-nums text-[#c0cde0] w-12 text-right">
                            {score.toFixed(1)}%
                          </span>
                        </div>
                      </button>
                      <div className="px-4 pb-3 pt-0 grid grid-cols-2 gap-2 font-mono text-[10px] text-[#7a8aaa]">
                        <div>Rows: {(t.row_count ?? 0).toLocaleString()}</div>
                        <div>Dead tuples (stat): {(t.dead_rows ?? 0).toLocaleString()}</div>
                      </div>
                      {isOpen && (
                        <div className="px-4 pb-4 border-t border-[#1e2540] pt-3 bg-[#0c0f1a]/30">
                          <span className="font-mono text-[9px] text-[#4a5a7a] uppercase tracking-wider block mb-2">
                            Reason behind the score
                          </span>
                          {factors.length === 0 ? (
                            <p className="font-body text-xs text-[#5a6a8a]">
                              No score reasons returned from the API (update the backend).
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {factors.map((f, idx) => (
                                <li
                                  key={idx}
                                  className="font-body text-xs text-[#a0b0c8] leading-relaxed pl-3 border-l-2"
                                  style={{ borderColor: `${openLayer.color ?? '#3ecfff'}55` }}
                                >
                                  {f}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
