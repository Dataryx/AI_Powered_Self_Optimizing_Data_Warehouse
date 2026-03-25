import { motion } from 'framer-motion';
import { History, CheckCircle2, UserCheck } from 'lucide-react';
import { formatLocalDateTime } from '../../utils/time';

interface OptimizationHistoryProps { data?: any; loading?: boolean }

function mapHistoryRow(h: any, i: number) {
  const table = h?.table ?? h?.table_name ?? '—';
  const cols = Array.isArray(h?.columns) ? h.columns.join(', ') : String(h?.columns ?? '—');
  const type = String(h?.type ?? 'index').toLowerCase();
  const priority = String(h?.priority ?? 'medium').toLowerCase();
  const typeLabel = type === 'partition' ? 'Partition' : 'Index';
  const priLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
  const priColor =
    priority === 'high' ? 'bg-topo-1 text-white' : priority === 'medium' ? 'bg-topo-2 text-white' : 'bg-ink-faint/30 text-ink';
  const typeColor = type === 'partition' ? 'bg-topo-2 text-white' : 'bg-topo-6 text-white';
  let appliedAt = '—';
  if (h?.created_at) appliedAt = formatLocalDateTime(h.created_at);
  return {
    key: String(h?.recommendation_id ?? `${table}-${i}`),
    table,
    tags: [
      { label: typeLabel, color: typeColor },
      { label: priLabel, color: priColor },
    ],
    appliedAt,
    appliedBy: 'Recorded from optimization catalog',
    columns: cols,
  };
}

export default function OptimizationHistory({ data, loading }: OptimizationHistoryProps) {
  const isDemo = Boolean(data?.demoFlags?.history);
  const raw = Array.isArray(data?.history) ? data.history : [];
  const entries = raw.map(mapHistoryRow);

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
              {isDemo && (
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  Sample
                </span>
              )}
            </div>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">Applied optimizations timeline</p>
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
          <div className="py-10 text-center font-body text-sm text-ink-muted">No optimization history yet.</div>
        )}

        {entries.map((entry, i) => (
          <motion.div
            key={entry.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 + 0.3 }}
            className="bg-base/50 rounded-xl border border-contour p-5 hover:border-contour-strong transition-all group"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-body text-base font-bold text-ink">{entry.table}</h4>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag.label}
                      className={`inline-block px-2 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-wider ${tag.color}`}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="w-7 h-7 rounded-full bg-topo-4/15 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={16} className="text-topo-4" />
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
                <span className="inline-block px-2 py-0.5 rounded-md bg-topo-6/10 font-mono text-[10px] text-topo-6 font-bold max-w-[60%] truncate text-right" title={entry.columns}>
                  {entry.columns}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
