import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, History, CheckCircle2, UserCheck } from 'lucide-react';
import { formatLocalDateTime } from '../../utils/time';

interface OptimizationHistoryProps { data?: any; loading?: boolean }

type HistoryTag = { label: string; color: string };
type HistoryEntry = {
  key: string;
  table: string;
  tags: HistoryTag[];
  appliedAt: string;
  appliedBy: string;
  columns: string;
  detail: Record<string, unknown>;
};

function formatEstimatedImprovement(v: unknown): string {
  if (v == null || v === '') return '—';
  const n = typeof v === 'number' ? v : parseFloat(String(v).trim().replace(/%$/, ''));
  if (Number.isNaN(n)) return '—';
  if (n >= 0 && n <= 1) return `${(n * 100).toFixed(1)}%`;
  return `${n.toFixed(1)}%`;
}

function normalizeHistoryColumns(h: any): string {
  const c = h?.columns;
  if (Array.isArray(c)) return c.map(String).join(', ') || '—';
  if (typeof c === 'string') {
    const t = c.trim();
    if (t.startsWith('[')) {
      try {
        const p = JSON.parse(t) as unknown;
        if (Array.isArray(p)) return p.map(String).join(', ') || '—';
      } catch {
        /* ignore */
      }
    }
    return t || '—';
  }
  return '—';
}

function mapHistoryRow(h: any, i: number): HistoryEntry {
  const table = h?.table ?? h?.table_name ?? '—';
  const cols = normalizeHistoryColumns(h);
  const type = String(h?.type ?? 'index').toLowerCase();
  const priority = String(h?.priority ?? 'medium').toLowerCase();
  const typeLabel = type === 'partition' ? 'Partition' : 'Index';
  const priLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
  const priColor =
    priority === 'high' ? 'bg-topo-1 text-white' : priority === 'medium' ? 'bg-topo-2 text-white' : 'bg-ink-faint/30 text-ink';
  const typeColor = type === 'partition' ? 'bg-topo-2 text-white' : 'bg-topo-6 text-white';
  const outcome = String(h?.apply_outcome ?? 'applied').toLowerCase();
  const outcomeTag =
    outcome === 'already_satisfied'
      ? { label: 'Already optimized', color: 'bg-sky-500/15 text-sky-300 border border-sky-500/35' }
      : null;
  const ts = h?.applied_at ?? h?.created_at;
  const appliedAt = ts ? formatLocalDateTime(ts) : '—';
  const src = String(h?.applied_by ?? 'dashboard').toLowerCase();
  const appliedBy = src === 'dashboard' ? 'Dashboard – Implement' : String(h?.applied_by ?? 'Dashboard – Implement');
  return {
    key: String(h?.recommendation_id ?? `${table}-${i}`),
    table,
    tags: [
      { label: typeLabel, color: typeColor },
      { label: priLabel, color: priColor },
      ...(outcomeTag ? [outcomeTag] : []),
    ],
    appliedAt,
    appliedBy,
    columns: cols,
    detail: h && typeof h === 'object' ? { ...h } : {},
  };
}

export default function OptimizationHistory({ data, loading }: OptimizationHistoryProps) {
  const raw = Array.isArray(data?.history) ? data.history : [];
  const entries: HistoryEntry[] = raw.map(mapHistoryRow);
  const PAGE_SIZE = 3;

  const total = entries.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const [page, setPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    // If new history arrives, reset to page 1 so users see the newest items.
    setPage(1);
    setExpandedKey(null);
  }, [total]);

  useEffect(() => {
    setExpandedKey(null);
  }, [page]);

  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageEntries = useMemo(() => {
    return entries.slice(startIdx, startIdx + PAGE_SIZE);
  }, [entries, startIdx]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-surface rounded-2xl border border-contour-strong overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-topo-4/12 flex items-center justify-center">
            <History size={17} className="text-topo-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-body text-base font-bold text-ink">Optimization History</h3>
            </div>
          </div>
        </div>
        <span className="font-body text-sm font-bold text-topo-5">{entries.length}</span>
      </div>

      {/* Entries */}
      <div className="px-5 pb-5 space-y-4">
        {loading && entries.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-contour border-t-topo-4 animate-spin mb-4" />
            <span className="font-mono text-[10px] text-ink-faint">Loading history…</span>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="py-10 px-4 text-center font-body text-sm text-ink-muted max-w-md mx-auto leading-relaxed">
            No implementation history yet. Open <span className="text-ink-soft">Index</span> or{' '}
            <span className="text-ink-soft">Partition</span> recommendations and choose{' '}
            <span className="text-ink-soft">Implement</span> — completed actions will appear here.
          </div>
        )}

        {pageEntries.map((entry, i) => {
          const d = entry.detail;
          const isOpen = expandedKey === entry.key;
          const recId = String(d.recommendation_id ?? entry.key);
          const sql = String(d.sql_statement ?? '');
          const explanation = String(d.explanation ?? d.reason ?? '');
          const qCount = d.query_count != null ? Number(d.query_count).toLocaleString() : '—';
          const avgMs =
            d.avg_execution_time_ms != null && !Number.isNaN(Number(d.avg_execution_time_ms))
              ? `${Number(d.avg_execution_time_ms).toLocaleString(undefined, { maximumFractionDigits: 1 })} ms`
              : '—';
          const partCol = d.partition_column != null ? String(d.partition_column) : '';
          const executedDdl = String(d.executed_ddl ?? '').trim();
          const pgIndexName = String(d.created_index_name ?? '').trim();
          return (
            <motion.div
              key={entry.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 + 0.3 }}
              className="bg-base/50 rounded-xl border border-contour overflow-hidden hover:border-contour-strong transition-all group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h4 className="font-body text-base font-bold text-ink truncate">{entry.table}</h4>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {entry.tags.map((tag: HistoryTag) => (
                        <span
                          key={tag.label}
                          className={`inline-block px-2 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-wider ${tag.color}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setExpandedKey(isOpen ? null : entry.key)}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface border border-contour/60 transition-colors"
                      aria-label={isOpen ? 'Hide details' : 'Show details'}
                    >
                      <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div className="w-7 h-7 rounded-full bg-topo-4/15 flex items-center justify-center">
                      <CheckCircle2 size={16} className="text-topo-4" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-ink-muted shrink-0">Recorded at</span>
                    <span className="font-mono text-[11px] text-ink font-medium text-right">{entry.appliedAt}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-ink-muted shrink-0">Source</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserCheck size={12} className="text-ink-faint shrink-0" />
                      <span className="font-mono text-[11px] text-ink font-medium truncate">{entry.appliedBy}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-ink-muted shrink-0">Columns / keys</span>
                    <span
                      className="inline-block px-2 py-0.5 rounded-md bg-topo-6/10 font-mono text-[10px] text-topo-6 font-bold max-w-[60%] truncate text-right"
                      title={entry.columns}
                    >
                      {entry.columns}
                    </span>
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-contour bg-surface/40 px-5 py-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 font-mono text-[10px]">
                    <div>
                      <span className="text-ink-faint uppercase tracking-wider">Recommendation ID</span>
                      <p className="text-ink-soft mt-0.5 break-all">{recId}</p>
                    </div>
                    <div>
                      <span className="text-ink-faint uppercase tracking-wider">Est. improvement</span>
                      <p className="text-ink mt-0.5 tabular-nums">{formatEstimatedImprovement(d.estimated_improvement)}</p>
                    </div>
                    <div>
                      <span className="text-ink-faint uppercase tracking-wider">Query volume</span>
                      <p className="text-ink mt-0.5 tabular-nums">{qCount}</p>
                    </div>
                    <div>
                      <span className="text-ink-faint uppercase tracking-wider">Avg exec (logged)</span>
                      <p className="text-ink mt-0.5 tabular-nums">{avgMs}</p>
                    </div>
                    {partCol ? (
                      <div className="sm:col-span-2">
                        <span className="text-ink-faint uppercase tracking-wider">Partition column</span>
                        <p className="text-ink-soft mt-0.5 font-mono">{partCol}</p>
                      </div>
                    ) : null}
                    {pgIndexName ? (
                      <div className="sm:col-span-2">
                        <span className="text-ink-faint uppercase tracking-wider">PostgreSQL index</span>
                        <p className="text-topo-5 mt-0.5 font-mono font-bold">{pgIndexName}</p>
                      </div>
                    ) : null}
                  </div>

                  {explanation.trim() ? (
                    <div>
                      <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">Rationale</span>
                      <p className="mt-1 font-body text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">
                        {explanation}
                      </p>
                    </div>
                  ) : null}

                  {executedDdl ? (
                    <div>
                      <span className="font-mono text-[10px] text-topo-5 uppercase tracking-wider font-bold">
                        Action executed
                      </span>
                      <pre className="mt-1 max-h-56 overflow-auto rounded-lg border border-topo-5/30 bg-surface p-3 font-mono text-[10px] text-ink-soft whitespace-pre-wrap break-words">
                        {executedDdl}
                      </pre>
                    </div>
                  ) : null}

                  <div>
                    <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">
                      Suggested script (manual review)
                    </span>
                    <pre className="mt-1 max-h-56 overflow-auto rounded-lg border border-contour bg-surface p-3 font-mono text-[10px] text-ink-soft whitespace-pre-wrap break-words">
                      {sql.trim()
                        ? sql
                        : 'No SQL statement is available for this entry.'}
                    </pre>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}

        {totalPages > 1 && !loading && (
          <div className="pt-4 border-t border-contour/60 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-[10px] text-ink-faint">
              Showing{' '}
              <span className="text-ink-soft tabular-nums">
                {total === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, total)}
              </span>{' '}
              of <span className="text-ink-soft tabular-nums">{total}</span>
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
