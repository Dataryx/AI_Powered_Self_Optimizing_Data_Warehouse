import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, RefreshCw, Eye, X } from 'lucide-react';
import type { AnalyticsPageData } from '../../hooks/useAnalyticsData';
import {
  deriveQueryAggregates,
  topQueriesByTotalTime,
  weightedMeanCacheHitRate,
  totalExecutionTimeMs,
  avgLatencySeconds,
  percentileLatencySeconds,
  type QueryPerfRow,
} from '../../utils/analyticsDerived';

interface QueryPerformanceImpactProps {
  data?: AnalyticsPageData;
  loading?: boolean;
  onRefresh?: () => void;
}

function fmtSecs(s: number | undefined): string {
  if (s == null || !Number.isFinite(s)) return '—';
  if (s < 1) {
    const ms = s * 1000;
    if (ms < 0.1) return `${ms.toFixed(4)} ms`;
    if (ms < 1) return `${ms.toFixed(3)} ms`;
    if (ms < 10) return `${ms.toFixed(2)} ms`;
    return `${ms.toFixed(1)} ms`;
  }
  return `${s.toFixed(2)}s`;
}

export default function QueryPerformanceImpact({ data, loading, onRefresh }: QueryPerformanceImpactProps) {
  const q = (data?.queryPerformance7d ?? []) as QueryPerfRow[];
  const agg = useMemo(() => deriveQueryAggregates(q), [q]);
  const top = useMemo(() => topQueriesByTotalTime(q, 8), [q]);
  /** Sum of wall time for the rows shown in the table — denominator for comparable impact bars. */
  const topSumMs = useMemo(
    () => top.reduce((sum, r) => sum + totalExecutionTimeMs(r), 0),
    [top],
  );
  const wCache = useMemo(() => weightedMeanCacheHitRate(q), [q]);
  const slowSharePct = agg.totalExecutions > 0 ? agg.slowExecutionShare * 100 : 0;
  const [activeRow, setActiveRow] = useState<QueryPerfRow | null>(null);
  return (
    <motion.div
      id="analytics-queries"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="bg-surface rounded-2xl border border-contour-strong overflow-hidden flex flex-col scroll-mt-24"
    >
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-topo-6/12 flex items-center justify-center shrink-0">
            <Activity size={17} className="text-topo-6" />
          </div>
          <div className="min-w-0">
            <h2 className="font-body text-base font-bold text-ink">Slow query impact</h2>
            {/* <p className="font-body text-[10px] text-ink-faint mt-0.5 leading-snug max-w-xl">
              Top 8 query types by total time in the 7-day window. Impact % is each query's share of total time across these eight.
            </p> */}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRefresh?.()}
          disabled={loading}
          className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-5 pb-3">
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-2">
          <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
            <p className="text-[10px] text-ink-faint">Query types</p>
            <p className="text-sm font-semibold text-ink tabular-nums">{agg.distinctQueries.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-topo-1/30 bg-topo-1/10 px-3 py-2">
                    <p className="text-[10px] text-ink-faint">Slow query types</p>
            <p className="text-sm font-semibold text-topo-1 tabular-nums">{agg.slowDistinct.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-topo-6/25 bg-topo-6/10 px-3 py-2">
                    <p className="text-[10px] text-ink-faint">Slow run %</p>
            <p className="text-sm font-semibold text-topo-6 tabular-nums">{slowSharePct.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border border-topo-4/25 bg-topo-4/10 px-3 py-2">
                    <p className="text-[10px] text-ink-faint">Typical wait</p>
            <p className="text-sm font-semibold text-topo-4 tabular-nums">{fmtSecs(agg.weightedAvgLatencySec)}</p>
          </div>
          <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                    <p className="text-[10px] text-ink-faint">Cache hit rate</p>
            <p className="text-sm font-semibold text-ink tabular-nums">{wCache != null ? `${(wCache * 100).toFixed(0)}%` : '—'}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 pb-5 min-h-[14rem]">
        {loading && top.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-contour border-t-topo-4 animate-spin mb-3" />
            <span className="font-body text-xs text-ink-muted">Loading query insights…</span>
          </div>
        ) : top.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-4 max-w-md mx-auto">
            <p className="font-body text-sm font-medium text-ink">No query data for the last 7 days</p>
            <p className="font-body text-xs text-ink-muted mt-2 leading-relaxed">
              This list will populate as new query activity is collected.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-contour overflow-hidden h-full min-h-0">
            <div className="h-full min-h-0 overflow-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="text-ink-faint sticky top-0 bg-surface border-b border-contour z-[1]">
                  <tr>
                    <th className="px-2 py-2 font-medium">#</th>
                    <th
                      className="px-2 py-2 font-medium"
                      title="Calls for this query hash in the window (ml_optimization.query_logs)"
                    >
                      Runs
                    </th>
                    <th
                      className="px-2 py-2 font-medium"
                      title="Weighted mean time per call: total_exec_time_ms / calls"
                    >
                      Typical
                    </th>
                    <th
                      className="px-2 py-2 font-medium"
                      title="95th percentile of per-row mean time (total/calls per log row)"
                    >
                      Worst (P95)
                    </th>
                    <th
                      className="px-2 py-2 font-medium"
                      title="Share of total time among these top queries only (bar + % sum to 100% across the listed rows)."
                    >
                      Impact %
                    </th>
                    <th className="px-2 py-2 font-medium text-right">View</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((row, i) => {
                    const totalMs = totalExecutionTimeMs(row);
                    const pctOfTop = topSumMs > 0 ? Math.min(100, (totalMs / topSumMs) * 100) : 0;
                    return (
                      <tr key={String(row.query_id ?? i)} className="border-t border-contour/50 align-top hover:bg-base/50">
                        <td className="px-2 py-1.5 text-ink-faint tabular-nums">{i + 1}</td>
                        <td className="px-2 py-1.5 text-ink-muted tabular-nums">
                          {(row.execution_count ?? 0).toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5 text-ink-muted tabular-nums">{fmtSecs(avgLatencySeconds(row))}</td>
                        <td className="px-2 py-1.5 text-ink-muted tabular-nums">{fmtSecs(percentileLatencySeconds(row, 'p95'))}</td>
                        <td className="px-2 py-1.5">
                          <div
                            className="flex items-center gap-2"
                            title={`${pctOfTop.toFixed(1)}% of time among these top queries (${q.length} query types in the 7d response)`}
                          >
                            <div
                              className="w-24 h-2 rounded-md bg-base overflow-hidden border border-contour/80 shrink-0"
                              role="progressbar"
                              aria-valuenow={Math.round(pctOfTop)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label="Share of time among listed top queries"
                            >
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pctOfTop}%` }}
                                transition={{ duration: 0.35, delay: i * 0.03 }}
                                className="h-full bg-gradient-to-r from-topo-6 to-cyan-600/80"
                              />
                            </div>
                            <span className="text-[10px] text-ink tabular-nums font-medium min-w-[3rem] text-right shrink-0">
                              {pctOfTop.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => setActiveRow(row)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-contour text-ink-muted hover:text-ink hover:border-topo-6/40"
                            aria-label="View slow query details"
                            title="View slow query details"
                          >
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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
                <h4 className="font-body text-sm font-semibold text-ink">Slow query details</h4>
                <p className="font-body text-[11px] text-ink-faint">Query details and performance metrics</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveRow(null)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-contour text-ink-muted hover:text-ink"
                aria-label="Close slow query details"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-4 sm:px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint">log_id</p>
                  <p className="text-sm font-semibold text-topo-4 font-mono tabular-nums">
                    {activeRow.sample_log_id != null ? activeRow.sample_log_id : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint" title="Calls in window">
                    Runs
                  </p>
                  <p className="text-sm font-semibold text-ink tabular-nums">
                    {(activeRow.execution_count ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint" title="total_exec_time_ms / calls">
                    Typical (avg / run)
                  </p>
                  <p className="text-sm font-semibold text-ink tabular-nums">
                    {fmtSecs(avgLatencySeconds(activeRow))}
                  </p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint" title="P50 of per-row mean time">
                    Median (P50)
                  </p>
                  <p className="text-sm font-semibold text-ink tabular-nums">
                    {fmtSecs(percentileLatencySeconds(activeRow, 'p50'))}
                  </p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint" title="P95 of per-row mean time">
                    Worst (P95)
                  </p>
                  <p className="text-sm font-semibold text-ink tabular-nums">
                    {fmtSecs(percentileLatencySeconds(activeRow, 'p95'))}
                  </p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint" title="Σ total_exec_time_ms in window">
                    Total time
                  </p>
                  <p className="text-sm font-semibold text-ink tabular-nums">
                    {fmtSecs(totalExecutionTimeMs(activeRow) / 1000)}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-contour bg-base/30 p-3">
                <p className="font-body text-[11px] text-ink-faint mb-2">Query text</p>
                <p className="font-mono text-[11px] text-ink-soft break-all leading-relaxed">
                  {activeRow.query_text_preview || 'No sample available.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
