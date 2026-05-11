import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { TableProperties, CheckCircle, Zap, RefreshCw, Loader2, DatabaseZap } from 'lucide-react';
import { api, formatOptimizationApplyError } from '../../services/api';
import { recommendationApplySnapshot } from '../../utils/recommendationApplySnapshot';

interface IndexRecommendationsProps { data?: any; loading?: boolean; onRefetch?: () => void }

function recommendationSourceBadge(src: unknown): { label: string; className: string } | null {
  if (typeof src !== 'string' || !src.trim()) return null;
  const key = src.trim();
  const map: Record<string, { label: string; className: string }> = {
    ml_query_logs: { label: 'Live activity', className: 'bg-topo-4/15 text-topo-4' },
    ml_pg_stat: { label: 'Live database', className: 'bg-violet-500/15 text-violet-300' },
    ml_mixed: { label: 'Live blended', className: 'bg-cyan-500/12 text-cyan-300' },
    persisted_db: { label: 'Saved record', className: 'bg-ink-faint/20 text-ink-muted' },
    pg_stat_heuristic: { label: 'System insight', className: 'bg-amber-500/12 text-amber-300/90' },
    workload_partition: { label: 'Live trend', className: 'bg-sky-500/12 text-sky-300' },
  };
  return map[key] ?? { label: key.replace(/_/g, ' '), className: 'bg-ink-faint/15 text-ink-faint' };
}

export default function IndexRecommendations({ data, loading, onRefetch }: IndexRecommendationsProps) {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  /** Inline strip under header — no browser dialog or OS notification. */
  const [implementNotice, setImplementNotice] = useState<{ ok: boolean; text: string } | null>(null);
  /** Rows removed from this list after a successful implement (status lives in Optimization History). */
  const [dismissedIds, setDismissedIds] = useState<Record<string, true>>({});
  const [applyFeedback, setApplyFeedback] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!implementNotice) return;
    const t = setTimeout(() => setImplementNotice(null), 8000);
    return () => clearTimeout(t);
  }, [implementNotice]);

  useEffect(() => {
    if (!applyFeedback) return;
    const t = setTimeout(() => setApplyFeedback(null), 8000);
    return () => clearTimeout(t);
  }, [applyFeedback]);

  const allRecs = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const recs = useMemo(() => {
    return allRecs
      .filter((r: any) => r?.type === 'index' || !r?.type)
      .filter((r: any) => {
        const sid = r?.recommendation_id as string | undefined;
        if (!sid) return true;
        if (dismissedIds[sid]) return false;
        if (String(r?.status ?? '').toLowerCase() === 'applied') return false;
        return true;
      });
  }, [allRecs, dismissedIds]);

  async function handleImplementIndex(rec: any): Promise<void> {
    const id = rec?.recommendation_id;
    if (!id || applyingId) return;
    const label = rec?.table ?? rec?.table_name ?? 'table';
    setApplyingId(id);
    setApplyFeedback(null);
    try {
      const res = await api.applyOptimization(
        id,
        false,
        recommendationApplySnapshot(rec as Record<string, unknown>),
      );
      if (res.outcome === 'already_satisfied') {
        setDismissedIds((p) => ({ ...p, [id]: true }));
        setImplementNotice({
          ok: true,
          text: `Index already in place for ${label} — recorded in Optimization History below.`,
        });
        return;
      }
      if (res.persisted !== true) {
        setApplyFeedback({
          id,
          ok: false,
          msg:
            'The action could not be confirmed on the server. Please check service connectivity and try again.',
        });
        return;
      }
      setDismissedIds((p) => ({ ...p, [id]: true }));
      const name = res.created_index_name ? String(res.created_index_name) : '';
      setImplementNotice({
        ok: true,
        text: name
          ? `Index implemented (${name}) for ${label}. See Optimization History below.`
          : `Index implemented for ${label}. See Optimization History below.`,
      });
    } catch (e) {
      setApplyFeedback({
        id,
        ok: false,
        msg: formatOptimizationApplyError(e),
      });
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-surface rounded-2xl border border-contour-strong overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-topo-6/12 flex items-center justify-center">
            <TableProperties size={17} className="text-topo-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-body text-base font-bold text-ink">Index Recommendations</h3>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-body text-sm font-bold text-topo-5">{recs.length}</span>
          <button type="button" onClick={() => onRefetch?.()} className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors" aria-label="Refresh">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {implementNotice && (
        <div
          className={`mx-5 mb-1 flex items-start gap-2 rounded-lg border px-3 py-2 text-left ${
            implementNotice.ok
              ? 'border-topo-4/45 bg-topo-4/10 text-topo-4'
              : 'border-red-500/35 bg-red-500/10 text-red-600 dark:text-red-400'
          }`}
          role="status"
        >
          <CheckCircle size={14} className="shrink-0 mt-0.5 opacity-90" aria-hidden />
          <p className="font-mono text-[11px] leading-snug m-0">{implementNotice.text}</p>
        </div>
      )}
      {/* Content */}
      <div className="px-5 pb-4">
        {loading && recs.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-contour border-t-topo-4 animate-spin mb-4" />
            <span className="font-mono text-[10px] text-ink-faint">Loading recommendations…</span>
          </div>
        )}
        {!loading && recs.length > 0 && (
          <div
            className="space-y-3 overflow-y-auto pr-1 max-h-[22rem] scroll-smooth border border-contour/40 rounded-xl p-2 bg-base/20"
            style={{ scrollbarGutter: 'stable' }}
          >
            {recs.map((r: any, i: number) => {
              const tableName = r?.table ?? r?.table_name ?? 'Table';
              const priority = (r?.priority ?? '').toLowerCase();
              const priorityColor = priority === 'high' ? 'bg-amber-500/20 text-amber-400' : priority === 'medium' ? 'bg-topo-4/20 text-topo-4' : 'bg-ink-faint/20 text-ink-muted';
              const srcBadge = recommendationSourceBadge(r?.recommendation_source);
              const rid = r?.recommendation_id as string | undefined;
              return (
                <motion.div
                  key={r?.recommendation_id ?? i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-xl bg-base border border-contour hover:border-contour-strong transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-body text-sm font-semibold text-ink truncate">{tableName}</span>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      {srcBadge ? (
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono text-[8px] font-bold uppercase tracking-wide ${srcBadge.className}`}
                          title={`Source: ${r?.recommendation_source}`}
                        >
                          {srcBadge.label}
                        </span>
                      ) : null}
                      <span className={`shrink-0 px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${priorityColor}`}>
                        {r?.priority ?? '—'}
                      </span>
                    </div>
                  </div>
                  {(r?.reason || r?.query_count != null || r?.avg_execution_time_ms != null) && (
                    <p className="font-mono text-[11px] text-ink-faint mt-0.5">
                      {r?.reason ?? (r?.query_count != null ? `Sequential scans: ${r.query_count}` : '')}
                      {r?.avg_execution_time_ms != null && r.avg_execution_time_ms > 0 ? ` · Avg ${Number(r.avg_execution_time_ms).toFixed(0)} ms` : ''}
                    </p>
                  )}
                  {Array.isArray(r?.columns) && r.columns.length > 0 && (
                    <p className="font-mono text-[10px] text-ink-muted mt-1">Columns: {r.columns.join(', ')}</p>
                  )}
                  {r?.sql_statement && (
                    <pre className="mt-2 p-2 rounded-lg bg-surface-alt border border-contour font-mono text-[9px] text-ink-soft overflow-x-auto whitespace-pre-wrap break-all">
                      {r.sql_statement}
                    </pre>
                  )}
                  {r?.estimated_improvement != null && (
                    <div className="mt-2 flex items-center gap-1">
                      <Zap size={10} className="text-topo-4" />
                      <span className="font-mono text-[10px] text-topo-4">Est. improvement: {(Number(r.estimated_improvement) * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-contour/60 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      disabled={!rid || applyingId === rid}
                      onClick={() => handleImplementIndex(r)}
                      className="inline-flex items-center justify-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-all disabled:pointer-events-none bg-gradient-to-br from-teal-500 to-cyan-600 text-white border-teal-400/40 shadow-md shadow-teal-950/25 hover:from-teal-400 hover:to-cyan-500 hover:shadow-teal-900/30 disabled:opacity-45"
                    >
                      {applyingId === rid ? (
                        <>
                          <Loader2 size={14} className="animate-spin shrink-0 text-cyan-100" />
                          Applying…
                        </>
                      ) : (
                        <>
                          <DatabaseZap size={14} className="shrink-0" />
                          Implement index
                        </>
                      )}
                    </button>
                    {applyFeedback && applyFeedback.id === rid && (
                      <p
                        className={`font-mono text-[10px] sm:text-right sm:max-w-[55%] ${applyFeedback.ok ? 'text-topo-4' : 'text-red-500 dark:text-red-400'}`}
                        role="status"
                      >
                        {applyFeedback.msg}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        {!loading && recs.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-topo-4/8 border border-topo-4/15 flex items-center justify-center mb-4">
              <CheckCircle size={26} className="text-topo-4" />
            </div>
            <span className="font-body text-sm font-medium text-ink">No index recommendations</span>
            <span className="font-mono text-[11px] text-ink-faint mt-1">Current workload signals do not indicate additional index actions.</span>
          </div>
        )}
      </div>

    </motion.div>
  );
}
