import { motion } from 'framer-motion';
import { Gauge, PenLine } from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatLocalDateTime } from '../../utils/time';

const timeRanges = ['Last 7 days', 'Last 30 days', 'Last 90 days'];
const QUERY_PAGE_SIZE = 10;

interface QueryPerformanceProps { data?: any; loading?: boolean }

function fmtSeconds(s: number | undefined | null): string {
  if (s == null || Number.isNaN(s)) return '—';
  if (s < 1) return `${(s * 1000).toFixed(0)} ms`;
  return `${s.toFixed(3)} s`;
}

export default function QueryPerformance({ data, loading }: QueryPerformanceProps) {
  const [range, setRange] = useState('Last 7 days');
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const isDemo = Boolean(data?.demoFlags?.queryPerformance);
  const rows = Array.isArray(data?.queryPerformance) ? data.queryPerformance : [];
  const totalPages = Math.max(1, Math.ceil(rows.length / QUERY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * QUERY_PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + QUERY_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
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
              {isDemo && (
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  Sample
                </span>
              )}
            </div>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">Execution time analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[9px] text-ink-faint tracking-wider whitespace-nowrap">Time Range</span>
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
                {timeRanges.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setRange(r); setOpen(false); }}
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
            <span className="font-body text-sm text-ink-muted">No query performance data available</span>
          </div>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-contour">
            <table className="min-w-full text-left font-mono text-[11px]">
              <thead>
                <tr className="bg-base border-b border-contour">
                  <th className="px-3 py-2.5 text-ink-muted font-bold">Query</th>
                  <th className="px-3 py-2.5 text-ink-muted font-bold">Runs</th>
                  <th className="px-3 py-2.5 text-ink-muted font-bold">Avg</th>
                  <th className="px-3 py-2.5 text-ink-muted font-bold">p95</th>
                  <th className="px-3 py-2.5 text-ink-muted font-bold">Total time</th>
                  <th className="px-3 py-2.5 text-ink-muted font-bold">Last run</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((q: any, i: number) => (
                  <tr key={`${pageStart + i}-${q.query_id ?? q.query_hash ?? i}`} className="border-b border-contour/80 hover:bg-base/50">
                    <td className="px-3 py-2 text-ink-soft max-w-[200px] truncate" title={q.query_id ?? q.query_hash}>
                      {String(q.query_id ?? q.query_hash ?? '—').slice(0, 18)}…
                    </td>
                    <td className="px-3 py-2 text-ink tabular-nums">{Number(q.execution_count ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-ink tabular-nums">{fmtSeconds(q.avg_execution_time)}</td>
                    <td className="px-3 py-2 text-ink tabular-nums">{fmtSeconds(q.p95_execution_time)}</td>
                    <td className="px-3 py-2 text-ink tabular-nums">{fmtSeconds(q.total_execution_time)}</td>
                    <td className="px-3 py-2 text-ink-muted whitespace-nowrap">
                      {q.last_executed ? formatLocalDateTime(q.last_executed) : '—'}
                    </td>
                  </tr>
                ))}
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
