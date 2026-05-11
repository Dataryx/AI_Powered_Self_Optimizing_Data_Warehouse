import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Eye, X } from 'lucide-react';
import type { AnalyticsPageData } from '../../hooks/useAnalyticsData';
import type { QueryPerfRow } from '../../utils/analyticsDerived';
import { avgLatencySeconds } from '../../utils/analyticsDerived';

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
  avgMs1d: number | null;
  avgMs7d: number | null;
  avgMsLong: number | null;
};

function n(v: unknown): number {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function queryKey(q: QueryPerfRow): string | null {
  const id = String(q.query_id ?? q.query_hash ?? '').trim();
  return id || null;
}

/** Seconds per call — same rules as Query Performance / analytics panels. */
function avgSeconds(q: QueryPerfRow): number {
  return avgLatencySeconds(q);
}

/** Prefer 1d ranking, then 7d, then long window — matches backend union refill ordering. */
function orderedUnionIds(...groups: QueryPerfRow[][]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rows of groups) {
    for (const r of rows) {
      const id = queryKey(r);
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

/** Latency for one window; ``undefined`` row ⇒ NaN (do not substitute another window). */
function avgSecondsOptional(row: QueryPerfRow | undefined): number {
  if (!row) return NaN;
  const v = avgSeconds(row);
  return Number.isFinite(v) ? v : NaN;
}

function computeTrendPctMs(ms1d: number | null, ms7d: number | null, msLong: number | null): number {
  /**
   * Recent vs long-term norm: baseline prefers **long** window (matches “hotspot” intuition).
   * Falls back to 7d when long is missing so Trend ≠ parroting the 7d latency column.
   */
  const baseline =
    msLong != null && msLong > 0 ? msLong : ms7d != null && ms7d > 0 ? ms7d : NaN;
  const recent = ms1d != null && ms1d >= 0 ? ms1d : NaN;
  if (!Number.isFinite(baseline) || baseline <= 0) {
    return Number.isFinite(recent) && recent > 0 ? 100 : 0;
  }
  if (!Number.isFinite(recent)) return 0;
  return ((recent - baseline) / baseline) * 100;
}

function fmtDelta(p: number): string {
  if (!Number.isFinite(p)) return '—';
  const sign = p >= 0 ? '+' : '';
  const a = Math.abs(p);
  const d = a > 0 && a < 1 ? 2 : a < 10 ? 2 : 1;
  return `${sign}${p.toFixed(d)}%`;
}

/** Table/medium cells: prefer ms precision so Long / 7d / 1d rarely look identical by rounding. */
function fmtLatencyCell(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(3)} s`;
  return `${ms.toFixed(2)} ms`;
}

function execCount(row: QueryPerfRow | undefined): number | null {
  if (!row) return null;
  const v = row.execution_count;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.floor(x)) : null;
}

/** Average latency in ms as returned or implied by Σ ms / Σ calls. */
function avgMsFromRow(row: QueryPerfRow | undefined): number | null {
  if (!row) return null;
  const ms = row.avg_execution_time_ms;
  if (ms != null && Number.isFinite(Number(ms))) return Number(ms);
  const ec = execCount(row);
  const tms = row.total_execution_time_ms;
  if (ec != null && ec > 0 && tms != null && Number.isFinite(Number(tms))) {
    return Number(tms) / ec;
  }
  return null;
}

export default function MLHotspotTimeline({ data, loading, onRefresh }: MLHotspotTimelineProps) {
  const [activeRow, setActiveRow] = useState<HotspotRow | null>(null);
  const q1 = (data?.queryPerformance1d ?? []) as QueryPerfRow[];
  const q7 = (data?.queryPerformance7d ?? []) as QueryPerfRow[];
  const q30 = (data?.queryPerformance ?? []) as QueryPerfRow[];

  const hotspots = useMemo(() => {
    const m1 = new Map<string, QueryPerfRow>();
    const m7 = new Map<string, QueryPerfRow>();
    const m30 = new Map<string, QueryPerfRow>();
    for (const r of q1) {
      const id = queryKey(r);
      if (!id) continue;
      m1.set(id, r);
    }
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

    const idOrder = orderedUnionIds(q1, q7, q30);

    const rows: HotspotRow[] = [];

    for (const id of idOrder) {
      const r1 = m1.get(id);
      const r7 = m7.get(id);
      const r30 = m30.get(id);
      if (!r1 && !r7 && !r30) continue;

      const ms1 = avgMsFromRow(r1);
      const ms7 = avgMsFromRow(r7);
      const msL = avgMsFromRow(r30);
      const avg1d = ms1 != null ? ms1 / 1000 : avgSecondsOptional(r1);
      const avg7d = ms7 != null ? ms7 / 1000 : avgSecondsOptional(r7);
      const avg30d = msL != null ? msL / 1000 : avgSecondsOptional(r30);
      const growthPct = computeTrendPctMs(ms1, ms7, msL);
      const src = r1 ?? r7 ?? r30!;
      const runs = Math.max(0, Math.floor(n(src.execution_count)));
      const latencyForImpact = Number.isFinite(avg1d)
        ? avg1d
        : Number.isFinite(avg7d)
          ? avg7d
          : Number.isFinite(avg30d)
            ? avg30d
            : 0;
      const impactScore =
        Math.max(0, latencyForImpact * Math.max(1, runs)) * (1 + Math.max(0, growthPct) / 100);
      rows.push({
        queryId: id,
        runs,
        avg1d,
        avg7d,
        avg30d,
        growthPct,
        impactScore,
        sampleLogId: Number.isFinite(n(src.sample_log_id)) ? Math.floor(n(src.sample_log_id)) : null,
        queryTextPreview: String(r1?.query_text_preview ?? r7?.query_text_preview ?? r30?.query_text_preview ?? ''),
        avgMs1d: ms1,
        avgMs7d: ms7,
        avgMsLong: msL,
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
            No query performance samples in the selected windows yet. Collect query_logs and refresh the analytics bundle.
          </div>
        ) : (
          <div className="rounded-xl border border-contour overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="text-ink-faint sticky top-0 bg-surface border-b border-contour z-[1]">
                  <tr>
                    <th className="px-2 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Runs</th>
                    <th className="px-2 py-2 font-medium" title="Long window (data retention days)">
                      Long
                    </th>
                    <th className="px-2 py-2 font-medium">7d</th>
                    <th className="px-2 py-2 font-medium">1d</th>
                    <th className="px-2 py-2 font-medium" title="Trend: (1d avg − long avg) / long avg · falls back to 7d baseline if long missing">
                      Trend
                    </th>
                    <th className="px-2 py-2 font-medium text-right">View</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.map((r, i) => (
                    <tr key={`${r.queryId}-${i}`} className="border-t border-contour/50 hover:bg-base/40">
                      <td className="px-2 py-1.5 text-ink-faint tabular-nums">{i + 1}</td>
                      <td className="px-2 py-1.5 text-ink tabular-nums">{r.runs.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-ink-muted tabular-nums">{fmtLatencyCell(r.avgMsLong)}</td>
                      <td className="px-2 py-1.5 text-ink-muted tabular-nums">{fmtLatencyCell(r.avgMs7d)}</td>
                      <td className="px-2 py-1.5 text-ink tabular-nums font-semibold">{fmtLatencyCell(r.avgMs1d)}</td>
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
                  <p className="text-[10px] text-ink-faint">Trend (1d vs long)</p>
                  <p className={`text-sm font-semibold tabular-nums ${activeRow.growthPct >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {fmtDelta(activeRow.growthPct)}
                  </p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint">Long avg</p>
                  <p className="text-sm font-semibold text-ink tabular-nums">{fmtLatencyCell(activeRow.avgMsLong)}</p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint">7d avg</p>
                  <p className="text-sm font-semibold text-ink tabular-nums">{fmtLatencyCell(activeRow.avgMs7d)}</p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint">1d avg</p>
                  <p className="text-sm font-semibold text-ink tabular-nums">{fmtLatencyCell(activeRow.avgMs1d)}</p>
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
