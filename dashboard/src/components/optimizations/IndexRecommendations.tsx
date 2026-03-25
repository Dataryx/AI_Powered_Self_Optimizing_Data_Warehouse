import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { TableProperties, CheckCircle, Zap, RefreshCw, Loader2, DatabaseZap } from 'lucide-react';
import { api } from '../../services/api';

interface IndexRecommendationsProps { data?: any; loading?: boolean; onRefetch?: () => void }

export default function IndexRecommendations({ data, loading, onRefetch }: IndexRecommendationsProps) {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyFeedback, setApplyFeedback] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!applyFeedback) return;
    const t = setTimeout(() => setApplyFeedback(null), 6000);
    return () => clearTimeout(t);
  }, [applyFeedback]);

  const isDemo = Boolean(data?.demoFlags?.indexRecommendations);
  const allRecs = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const recs = allRecs.filter((r: any) => r?.type === 'index' || !r?.type);

  async function handleImplementIndex(rec: any) {
    const id = rec?.recommendation_id;
    if (!id || applyingId) return;
    setApplyingId(id);
    setApplyFeedback(null);
    try {
      await api.applyOptimization(id, false);
      setApplyFeedback({ id, ok: true, msg: 'Implementation recorded. Refresh list if status updates on the server.' });
      onRefetch?.();
    } catch (e) {
      setApplyFeedback({
        id,
        ok: false,
        msg: e instanceof Error ? e.message : 'Could not reach optimization API.',
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
              {isDemo && (
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  Sample
                </span>
              )}
            </div>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">ML-generated optimization suggestions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-body text-sm font-bold text-topo-5">{recs.length}</span>
          <button type="button" onClick={() => onRefetch?.()} className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors" aria-label="Refresh">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

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
                    <span className={`shrink-0 px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${priorityColor}`}>
                      {r?.priority ?? '—'}
                    </span>
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
                      disabled={
                        !r?.recommendation_id ||
                        applyingId === r.recommendation_id ||
                        String(r?.status ?? '').toLowerCase() === 'applied'
                      }
                      onClick={() => handleImplementIndex(r)}
                      className={`inline-flex items-center justify-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg border transition-all disabled:pointer-events-none ${
                        String(r?.status ?? '').toLowerCase() === 'applied'
                          ? 'bg-slate-800/60 text-teal-300/95 border-teal-500/35'
                          : 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white border-teal-400/40 shadow-md shadow-teal-950/25 hover:from-teal-400 hover:to-cyan-500 hover:shadow-teal-900/30 disabled:opacity-45'
                      }`}
                    >
                      {applyingId === r.recommendation_id ? (
                        <>
                          <Loader2 size={14} className="animate-spin shrink-0 text-cyan-100" />
                          Applying…
                        </>
                      ) : String(r?.status ?? '').toLowerCase() === 'applied' ? (
                        <>
                          <CheckCircle size={14} className="shrink-0 text-teal-400" />
                          Applied
                        </>
                      ) : (
                        <>
                          <DatabaseZap size={14} className="shrink-0" />
                          Implement index
                        </>
                      )}
                    </button>
                    {applyFeedback?.id === r.recommendation_id && (
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
            <span className="font-mono text-[11px] text-ink-faint mt-1">All tables are optimally indexed or no workload data yet</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-contour bg-base/30">
        <span className="font-mono text-[10px] text-ink-faint">Recommendations are updated from query stats and post-execution performance.</span>
      </div>
    </motion.div>
  );
}
