import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Eye, X } from 'lucide-react';
import type { AnalyticsPageData } from '../../hooks/useAnalyticsData';
import type { QueryPerfRow } from '../../utils/analyticsDerived';

interface MLHotspotTimelineProps {
  data?: AnalyticsPageData;
  loading?: boolean;
  onRefresh?: () => void;
}

type HotspotRow = {
  queryId: string;
  runs: number;
  avg1d: number;
  avg7d: number;
  avg30d: number;
  growthPct: number;
  impactScore: number;
  sampleLogId: number | null;
  queryTextPreview: string;
};

function n(v: unknown): number {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function queryKey(q: QueryPerfRow): string | null {
  const id = String(q.query_id ?? q.query_hash ?? '').trim();
  return id || null;
}

function fmtSecs(s: number): string {
  if (!Number.isFinite(s)) return '—';
  if (s < 1) {
    const ms = s * 1000;
    if (ms < 0.1) return `${ms.toFixed(4)} ms`;
    if (ms < 1) return `${ms.toFixed(3)} ms`;
    if (ms < 10) return `${ms.toFixed(2)} ms`;
    return `${ms.toFixed(1)} ms`;
  }
  return `${s.toFixed(2)} s`;
}

function fmtDelta(p: number): string {
  if (!Number.isFinite(p)) return '—';
  const sign = p >= 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

export default function MLHotspotTimeline({ data, loading, onRefresh }: MLHotspotTimelineProps) {
  const [activeRow, setActiveRow] = useState<HotspotRow | null>(null);
  const q1 = (data?.queryPerformance1d ?? []) as QueryPerfRow[];
  const q7 = (data?.queryPerformance7d ?? []) as QueryPerfRow[];
  const q30 = (data?.queryPerformance ?? []) as QueryPerfRow[];

  const hotspots = useMemo(() => {
    const m7 = new Map<string, QueryPerfRow>();
    const m30 = new Map<string, QueryPerfRow>();
    for (const r of q7) {
      const id = queryKey(r);
      if (!id) continue;
      m7.set(id, r);
    }
    for (const r of q30) {
      const id = queryKey(r);
      if (!id) continue;
      m30.set(id, r);
    }

    // Strictly real timeline rows: require the query to exist in 1d, 7d, and 30d windows.
    const seed = q1;
    const rows: HotspotRow[] = [];
    const seen = new Set<string>();

    for (const r of seed) {
      const id = queryKey(r);
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      const r7 = m7.get(id);
      const r30 = m30.get(id);
      if (!r7 || !r30) continue;
      const avg1d = n(r.avg_execution_time);
      const avg7d = n(r7.avg_execution_time);
      const avg30d = n(r30.avg_execution_time);
      const baseline = avg7d > 0 ? avg7d : avg30d;
      const growthPct = baseline > 0 ? ((avg1d - baseline) / baseline) * 100 : avg1d > 0 ? 100 : 0;
      const runs = Math.max(0, Math.floor(n(r.execution_count)));
      const impactScore = Math.max(0, avg1d * Math.max(1, runs)) * (1 + Math.max(0, growthPct) / 100);
      rows.push({
        queryId: id,
        runs,
        avg1d,
        avg7d,
        avg30d,
        growthPct,
        impactScore,
        sampleLogId: Number.isFinite(n(r.sample_log_id))
          ? Math.floor(n(r.sample_log_id))
          : null,
        queryTextPreview: String(r.query_text_preview ?? ''),
      });
    }

    rows.sort((a, b) => b.impactScore - a.impactScore);
    return rows.slice(0, 13);
  }, [q1, q7, q30]);

  return (
    <motion.div
      id="analytics-hotspots"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mt-6 bg-surface rounded-2xl border border-contour-strong overflow-hidden"
    >
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-topo-4/12 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-topo-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-body text-base font-bold text-ink">ML Hotspot Timeline</h2>
            {/* <p className="font-body text-[10px] text-ink-faint mt-0.5">
              Top 13 rising hotspots by latest latency and trend (30d → 7d → 1d).
            </p> */}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRefresh?.()}
          disabled={loading}
          className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
          aria-label="Refresh hotspot timeline"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-5 pb-5">
        {loading && hotspots.length === 0 ? (
          <div className="py-12 text-center text-xs text-ink-faint">Loading hotspots…</div>
        ) : hotspots.length === 0 ? (
          <div className="py-12 text-center text-xs text-ink-faint">
            No real hotspot timeline data available (requires distinct 1d, 7d, and 30d query windows).
          </div>
        ) : (
          <div className="rounded-xl border border-contour overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="text-ink-faint sticky top-0 bg-surface border-b border-contour z-[1]">
                  <tr>
                    <th className="px-2 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Runs</th>
                    <th className="px-2 py-2 font-medium">30d</th>
                    <th className="px-2 py-2 font-medium">7d</th>
                    <th className="px-2 py-2 font-medium">1d</th>
                    <th className="px-2 py-2 font-medium">Trend</th>
                    <th className="px-2 py-2 font-medium text-right">View</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.map((r, i) => (
                    <tr key={`${r.queryId}-${i}`} className="border-t border-contour/50 hover:bg-base/40">
                      <td className="px-2 py-1.5 text-ink-faint tabular-nums">{i + 1}</td>
                      <td className="px-2 py-1.5 text-ink tabular-nums">{r.runs.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-ink-muted tabular-nums">{fmtSecs(r.avg30d)}</td>
                      <td className="px-2 py-1.5 text-ink-muted tabular-nums">{fmtSecs(r.avg7d)}</td>
                      <td className="px-2 py-1.5 text-ink tabular-nums font-semibold">{fmtSecs(r.avg1d)}</td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`inline-flex items-center gap-1 font-mono tabular-nums ${
                            r.growthPct >= 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {r.growthPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {fmtDelta(r.growthPct)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveRow(r)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-contour text-ink-muted hover:text-ink hover:border-topo-4/40"
                          aria-label="View hotspot query details"
                          title="View hotspot query details"
                        >
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {activeRow ? (
        <div className="fixed inset-0 z-[70] bg-black/55 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-3xl rounded-2xl border border-contour-strong bg-surface shadow-xl overflow-hidden flex flex-col">
            <div className="px-4 sm:px-5 py-3 border-b border-contour flex items-center justify-between gap-3">
              <div>
                <h4 className="font-body text-sm font-semibold text-ink">Hotspot details</h4>
                <p className="font-body text-[11px] text-ink-faint">Timeline trend and query sample</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveRow(null)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-contour text-ink-muted hover:text-ink"
                aria-label="Close hotspot details"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-4 sm:px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint">log_id</p>
                  <p className="text-sm font-semibold text-topo-4 font-mono tabular-nums">
                    {activeRow.sampleLogId != null ? activeRow.sampleLogId : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint">Runs</p>
                  <p className="text-sm font-semibold text-ink tabular-nums">{activeRow.runs.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint">Trend</p>
                  <p className={`text-sm font-semibold tabular-nums ${activeRow.growthPct >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {fmtDelta(activeRow.growthPct)}
                  </p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint">30d avg</p>
                  <p className="text-sm font-semibold text-ink tabular-nums">{fmtSecs(activeRow.avg30d)}</p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint">7d avg</p>
                  <p className="text-sm font-semibold text-ink tabular-nums">{fmtSecs(activeRow.avg7d)}</p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint">1d avg</p>
                  <p className="text-sm font-semibold text-ink tabular-nums">{fmtSecs(activeRow.avg1d)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-contour bg-base/30 p-3">
                <p className="font-body text-[11px] text-ink-faint mb-2">Query ID</p>
                <p className="font-mono text-[10px] text-ink-soft break-all">{activeRow.queryId}</p>
              </div>
              <div className="rounded-xl border border-contour bg-base/30 p-3">
                <p className="font-body text-[11px] text-ink-faint mb-2">Query sample</p>
                <p className="font-mono text-[11px] text-ink-soft break-all leading-relaxed">
                  {activeRow.queryTextPreview || 'No sample available.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
