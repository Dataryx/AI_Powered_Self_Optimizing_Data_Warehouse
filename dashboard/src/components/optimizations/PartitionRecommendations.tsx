import { motion } from 'framer-motion';
import { LayoutGrid, CheckCircle, RefreshCw, Layers } from 'lucide-react';

interface PartitionRecommendationsProps { data?: any; loading?: boolean; onRefetch?: () => void }

export default function PartitionRecommendations({ data, loading, onRefetch }: PartitionRecommendationsProps) {
  const isDemo = Boolean(data?.demoFlags?.partitionRecommendations);
  const allRecs = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const recs = allRecs.filter((r: any) => r?.type === 'partition');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-surface rounded-2xl border border-contour-strong overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-topo-2/12 flex items-center justify-center">
            <LayoutGrid size={17} className="text-topo-2" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-body text-base font-bold text-ink">Partition Recommendations</h3>
              {isDemo && (
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  Sample
                </span>
              )}
            </div>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">Partitioning suggestions for optimal performance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-body text-sm font-bold text-topo-2">{recs.length}</span>
          <button type="button" onClick={() => onRefetch?.()} className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors" aria-label="Refresh">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-4">
        {loading && recs.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-contour border-t-topo-2 animate-spin mb-4" />
            <span className="font-mono text-[10px] text-ink-faint">Loading partition recommendations…</span>
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
              const priorityColor = priority === 'high' ? 'bg-amber-500/20 text-amber-400' : priority === 'medium' ? 'bg-topo-2/20 text-topo-2' : 'bg-ink-faint/20 text-ink-muted';
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
                  {(r?.reason || r?.query_count != null) && (
                    <p className="font-mono text-[11px] text-ink-faint mt-0.5">
                      {r?.reason ?? (r?.query_count != null ? `Query count: ${r.query_count}` : '')}
                    </p>
                  )}
                  {Array.isArray(r?.columns) && r.columns.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                      <Layers size={10} className="text-topo-2 shrink-0" />
                      <span className="font-mono text-[10px] text-ink-muted">Partition key candidates: {r.columns.join(', ')}</span>
                    </div>
                  )}
                  {r?.sql_statement && (
                    <pre className="mt-2 p-2 rounded-lg bg-surface-alt border border-contour font-mono text-[9px] text-ink-soft overflow-x-auto whitespace-pre-wrap break-all">
                      {r.sql_statement}
                    </pre>
                  )}
                  {r?.estimated_improvement != null && (
                    <p className="mt-2 font-mono text-[10px] text-topo-2">Est. improvement: {(Number(r.estimated_improvement) * 100).toFixed(0)}%</p>
                  )}
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
            <span className="font-body text-sm font-medium text-ink">No partition recommendations</span>
            <span className="font-mono text-[11px] text-ink-faint mt-1">All tables are optimally partitioned or below size threshold</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-contour bg-base/30">
        <span className="font-mono text-[10px] text-ink-faint">Continuously refined using table size and execution feedback.</span>
      </div>
    </motion.div>
  );
}
