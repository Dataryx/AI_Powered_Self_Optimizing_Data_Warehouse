import { motion } from 'framer-motion';
import { ChevronDown, Gauge, PenLine } from 'lucide-react';
import { Fragment, useState, useEffect } from 'react';
import { formatLocalDateTime } from '../../utils/time';

const DEFAULT_TIME_RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days'];
const QUERY_PAGE_SIZE = 10;

interface QueryPerformanceProps {
  data?: any;
  loading?: boolean;
  /** Controlled from parent so query window matches the live optimization snapshot. */
  timeRange?: string;
  onTimeRangeChange?: (range: string) => void;
  timeRangeOptions?: string[];
}

function fmtSeconds(s: number | undefined | null): string {
  if (s == null || Number.isNaN(s)) return '—';
  if (s < 1) return `${(s * 1000).toFixed(0)} ms`;
  return `${s.toFixed(3)} s`;
}

function fmtPct01(x: number | undefined | null): string {
  if (x == null || Number.isNaN(x)) return '—';
  return `${(x * 100).toFixed(1)}%`;
}

export default function QueryPerformance({
  data,
  loading,
  timeRange: controlledRange,
  onTimeRangeChange,
  timeRangeOptions = DEFAULT_TIME_RANGES,
}: QueryPerformanceProps) {
  const [localRange, setLocalRange] = useState('Last 7 days');
  const range = controlledRange ?? localRange;
  const setRange = onTimeRangeChange ?? setLocalRange;
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const rows = Array.isArray(data?.queryPerformance) ? data.queryPerformance : [];
  const usedUnboundedFallback = Boolean(data?.queryPerformanceMeta?.usedUnboundedFallback);
  const totalPages = Math.max(1, Math.ceil(rows.length / QUERY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * QUERY_PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + QUERY_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    setExpandedRow(null);
  }, [rows.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-surface rounded-2xl border border-contour-strong overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 sm:px-5 pt-5 pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-topo-5/12 flex items-center justify-center">
            <Gauge size={17} className="text-topo-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-body text-base font-bold text-ink">Query Performance Analysis</h3>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[9px] text-ink-faint tracking-wider whitespace-nowrap">Time period</span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-contour-strong font-mono text-[11px] text-ink font-medium hover:bg-base transition-colors"
            >
              {range}
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-ink-faint"><path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-1 bg-surface border border-contour-strong rounded-xl shadow-lg z-20 py-1 min-w-[140px]">
                {timeRangeOptions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRange(r);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 font-mono text-[11px] hover:bg-base transition-colors ${
                      r === range ? 'text-topo-5 font-bold' : 'text-ink-soft'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 pb-5">
        {usedUnboundedFallback && rows.length > 0 && (
          <div className="mb-3 px-3 py-2 rounded-xl border border-amber-500/25 bg-amber-500/8 font-mono text-[10px] text-amber-800 dark:text-amber-200/90">
            The selected period has no query rows. Displaying top queries from the full available history.
          </div>
        )}
        {loading && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14">
            <div className="w-8 h-8 rounded-full border-2 border-contour border-t-topo-5 animate-spin mb-4" />
            <span className="font-mono text-[10px] text-ink-faint">Loading query performance…</span>
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14">
            <div className="w-14 h-14 rounded-full bg-base border border-contour-strong flex items-center justify-center mb-4">
              <PenLine size={22} className="text-ink-faint" />
            </div>
            <span className="font-body text-sm text-ink-muted">No query activity found for this period</span>
          </div>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-contour">
            <table className="min-w-full text-left font-mono text-[11px]">
              <thead>
                <tr className="bg-base border-b border-contour">
                  <th className="px-3 py-2.5 text-ink-muted font-bold w-8" aria-label="Expand" />
                  <th className="px-3 py-2.5 text-ink-muted font-bold">Query ID</th>
                  <th className="px-3 py-2.5 text-ink-muted font-bold">Executions</th>
                  <th className="px-3 py-2.5 text-ink-muted font-bold">Avg</th>
                  <th className="px-3 py-2.5 text-ink-muted font-bold">p95</th>
                  <th className="px-3 py-2.5 text-ink-muted font-bold">Total time</th>
                  <th className="px-3 py-2.5 text-ink-muted font-bold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((q: any, i: number) => {
                  const rowKey = `${pageStart + i}-${String(q.query_id ?? q.query_hash ?? i)}`;
                  const isOpen = expandedRow === rowKey;
                  const fullHash = String(q.query_id ?? q.query_hash ?? '—');
                  return (
                    <Fragment key={rowKey}>
                      <tr
                        className={`border-b border-contour/80 hover:bg-base/50 ${isOpen ? 'bg-base/40' : ''}`}
                      >
                        <td className="px-2 py-2 align-middle">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-label={isOpen ? 'Collapse row' : 'Expand row'}
                            onClick={() => setExpandedRow(isOpen ? null : rowKey)}
                            className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-base border border-transparent hover:border-contour transition-colors"
                          >
                            <ChevronDown
                              size={16}
                              className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            />
                          </button>
                        </td>
                        <td
                          className="px-3 py-2 text-ink-soft max-w-[min(280px,40vw)] truncate font-mono text-[10px]"
                          title={fullHash}
                        >
                          {fullHash.length > 22 ? `${fullHash.slice(0, 22)}…` : fullHash}
                        </td>
                        <td className="px-3 py-2 text-ink tabular-nums">{Number(q.execution_count ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-ink tabular-nums">{fmtSeconds(q.avg_execution_time)}</td>
                        <td className="px-3 py-2 text-ink tabular-nums">{fmtSeconds(q.p95_execution_time)}</td>
                        <td className="px-3 py-2 text-ink tabular-nums">{fmtSeconds(q.total_execution_time)}</td>
                        <td className="px-3 py-2 text-ink-muted whitespace-nowrap">
                          {q.last_executed ? formatLocalDateTime(q.last_executed) : '—'}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-contour/80 bg-base/60">
                          <td colSpan={7} className="px-4 py-4 align-top">
                            <div className="space-y-3 text-left">
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 font-mono text-[10px]">
                                <div>
                                  <span className="text-ink-faint uppercase tracking-wider">Query ID</span>
                                  <p className="text-ink-soft mt-0.5 break-all">{fullHash}</p>
                                </div>
                                <div>
                                  <span className="text-ink-faint uppercase tracking-wider">p50 / p99</span>
                                  <p className="text-ink mt-0.5 tabular-nums">
                                    {fmtSeconds(q.p50_execution_time)} / {fmtSeconds(q.p99_execution_time)}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-ink-faint uppercase tracking-wider">Cache hit rate</span>
                                  <p className="text-ink mt-0.5 tabular-nums">{fmtPct01(q.cache_hit_rate)}</p>
                                </div>
                                <div>
                                  <span className="text-ink-faint uppercase tracking-wider">Time window</span>
                                  <p className="text-ink-soft mt-0.5">{range}</p>
                                </div>
                              </div>
                              <div>
                                <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">
                                  Query text
                                </span>
                                <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-contour bg-surface p-3 font-mono text-[10px] text-ink-soft whitespace-pre-wrap break-words">
                                  {q.query_text_preview
                                    ? String(q.query_text_preview)
                                    : 'Query text is not available for this entry.'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > QUERY_PAGE_SIZE && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-[10px] text-ink-muted">
              Showing {pageStart + 1}–{Math.min(pageStart + QUERY_PAGE_SIZE, rows.length)} of {rows.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="font-mono text-[11px] px-3 py-1.5 rounded-lg border border-contour-strong text-ink-muted hover:text-ink hover:bg-base disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                Previous
              </button>
              <span className="font-mono text-[11px] text-ink-soft tabular-nums">
                Page {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="font-mono text-[11px] px-3 py-1.5 rounded-lg border border-contour-strong text-ink-muted hover:text-ink hover:bg-base disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
