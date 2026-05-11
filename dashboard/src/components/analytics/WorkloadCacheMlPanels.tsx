import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Info, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { WorkloadClustersPayload, CacheCandidatesPayload } from '../../hooks/useWorkloadCacheInsights';
import { api } from '../../services/api';
import { formatLocalTime } from '../../utils/time';

function pct(part: number, whole: number): string {
  if (!whole || !Number.isFinite(part)) return '0';
  return ((100 * part) / whole).toFixed(1);
}

function fmtMs(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(2)} s`;
  if (n === 0) return '0 ms';
  if (n < 0.1) return `${n.toFixed(4)} ms`;
  if (n < 1) return `${n.toFixed(3)} ms`;
  if (n < 10) return `${n.toFixed(2)} ms`;
  if (n < 100) return `${n.toFixed(1)} ms`;
  return `${n.toFixed(0)} ms`;
}

function formatGroupLabel(rawId: string): string {
  const n = Number(rawId);
  if (Number.isFinite(n)) return String(n + 1);
  return rawId;
}

interface WorkloadCacheMlPanelsProps {
  workload: WorkloadClustersPayload | null;
  cache: CacheCandidatesPayload | null; // Kept for compatibility with existing callsites.
  loading?: boolean;
  error?: string | null;
}

export default function WorkloadCacheMlPanels({
  workload,
  loading,
  error,
}: WorkloadCacheMlPanelsProps) {
  const totalQ = workload?.total_queries ?? 0;
  const counts = workload?.cluster_counts ?? {};
  const profiles = workload?.profiles ?? {};
  const orderedRawGroupIds = useMemo(() => {
    const profileIds = Object.keys(profiles);
    const profileIdSet = new Set(profileIds);
    const extraCountIds = Object.keys(counts).filter((rawId) => !profileIdSet.has(rawId));
    return [...profileIds, ...extraCountIds].sort((a, b) => Number(a) - Number(b));
  }, [profiles, counts]);
  const clusterEntries = useMemo(
    () =>
      orderedRawGroupIds
        .map((rawId) => [rawId, Number(counts[rawId] ?? 0)] as [string, number])
        .filter(([, count]) => Number.isFinite(count)),
    [orderedRawGroupIds, counts],
  );
  const largestClusterEntry = useMemo(() => {
    const pairs = Object.entries(counts);
    if (!pairs.length) return null;
    return pairs.reduce((best, cur) => (Number(cur[1]) > Number(best[1]) ? cur : best));
  }, [counts]);
  const topClusterShare = largestClusterEntry ? pct(Number(largestClusterEntry[1]), totalQ) : '0';

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupPage, setGroupPage] = useState(1);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupTotalPages, setGroupTotalPages] = useState(0);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupRows, setGroupRows] = useState<
    Array<{
      log_id?: number | null;
      query_hash?: string | null;
      query_preview?: string;
      calls_sum?: number;
      mean_exec_ms?: number;
      sample_count?: number;
      collected_at?: string | null;
    }>
  >([]);

  const fetchGroupPage = async (groupId: string, page: number) => {
    setGroupLoading(true);
    setGroupError(null);
    try {
      const res = await api.getWorkloadClusterQueries({
        clusterId: Number(groupId),
        page,
        pageSize: 10,
        sampleLimit: 5000,
      });
      setActiveGroupId(groupId);
      setGroupPage(res.page ?? page);
      setGroupTotal(res.total ?? 0);
      setGroupTotalPages(res.total_pages ?? 0);
      setGroupRows(res.queries ?? []);
      if (res.message) setGroupError(res.message);
    } catch (e) {
      setGroupError(e instanceof Error ? e.message : String(e));
      setGroupRows([]);
      setGroupTotal(0);
      setGroupTotalPages(0);
    } finally {
      setGroupLoading(false);
    }
  };

  const closeModal = () => {
    setActiveGroupId(null);
    setGroupRows([]);
    setGroupError(null);
    setGroupPage(1);
    setGroupTotal(0);
    setGroupTotalPages(0);
  };

  return (
    <motion.div
      id="analytics-ml-workload-cache"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="scroll-mt-24"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-body text-xs font-semibold uppercase tracking-widest text-ink-faint">Query insights</h2>
      </div>

      {error ? (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-amber-200/90 text-xs" role="status">
          {error}
        </div>
      ) : null}

      <div className="bg-surface rounded-2xl border border-contour-strong overflow-hidden shadow-sm">
        <div className="px-5 pt-4 pb-3 border-b border-contour/80 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-topo-6/12 flex items-center justify-center shrink-0">
            <Layers size={15} className="text-topo-6" aria-hidden />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="font-body text-sm font-semibold text-ink tracking-tight">Query groups</h3>
            {/* <p className="font-body text-[11px] text-ink-faint mt-0.5">Similar query behavior grouped together</p> */}
          </div>
        </div>

        <div className="px-5 py-2 flex flex-wrap gap-1.5 border-b border-contour/60 bg-base/30">
          <span className="px-2 py-0.5 rounded-md bg-base border border-contour/80 font-mono text-[10px] text-ink-soft">
            {workload?.model_loaded ? 'Ready' : 'Not ready'}
          </span>
          {workload?.algorithm ? (
            <span className="px-2 py-0.5 rounded-md bg-topo-6/10 border border-topo-6/15 font-mono text-[10px] text-topo-6 capitalize">
              {workload.algorithm}
            </span>
          ) : null}
        </div>

        <div className="p-5">
          {loading && !workload?.model_loaded ? (
            <div className="py-12 flex flex-col items-center gap-2">
              <div className="w-7 h-7 rounded-full border-2 border-contour border-t-topo-6 animate-spin" />
              <span className="text-[11px] text-ink-faint">Loading…</span>
            </div>
          ) : null}

          {!loading && workload && !workload.model_loaded ? (
            <div className="py-8 px-2 text-center">
              <Info size={16} className="mx-auto text-ink-faint mb-2 opacity-70" aria-hidden />
              <p className="font-body text-xs text-ink-muted">
                {workload.message ?? 'Train grouping model and restart the ML API.'}
              </p>
            </div>
          ) : null}

          {!loading && workload?.model_loaded && clusterEntries.length === 0 ? (
            <p className="font-body text-xs text-ink-faint py-6 text-center">No groups found in current sample.</p>
          ) : null}

          {workload?.model_loaded && clusterEntries.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint">Groups found</p>
                  <p className="text-sm font-semibold text-ink tabular-nums">{clusterEntries.length}</p>
                </div>
                <div className="rounded-lg border border-contour bg-base/40 px-3 py-2">
                  <p className="text-[10px] text-ink-faint">Largest group share</p>
                  <p className="text-sm font-semibold text-ink tabular-nums">{topClusterShare}%</p>
                </div>
              </div>

              <div className="space-y-2" title="How much of total query activity each group represents">
                {clusterEntries.map(([rawId, count]) => (
                  <div key={rawId} className="rounded-lg px-1.5 py-1 hover:bg-base/50 border border-transparent">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-[11px] text-ink-muted w-16 shrink-0">
                        Group {formatGroupLabel(rawId)}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-base border border-contour/90 overflow-hidden min-w-0">
                        <div className="h-full rounded-full bg-topo-6/65" style={{ width: `${pct(count, totalQ)}%` }} />
                      </div>
                      <span className="font-body text-[11px] text-ink tabular-nums w-24 text-right shrink-0">
                        {count.toLocaleString()} ({pct(count, totalQ)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-contour overflow-hidden">
                <div className="overflow-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-ink-faint sticky top-0 bg-surface border-b border-contour z-[1]">
                      <tr>
                        <th className="px-3 py-2 font-medium w-16">Group</th>
                        <th className="px-2 py-2 font-medium">Samples</th>
                        <th className="px-2 py-2 font-medium">Avg time</th>
                        <th className="px-2 py-2 font-medium">Avg joins</th>
                        <th className="px-2 py-2 font-medium text-right">View</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedRawGroupIds
                        .map((rawId) => [rawId, profiles[rawId]] as const)
                        .filter(([, p]) => p != null)
                        .map(([rawId, p]) => (
                          <tr key={rawId} className="border-t border-contour/50 hover:bg-base/50">
                            <td className="px-3 py-1.5 font-body text-topo-6">Group {formatGroupLabel(rawId)}</td>
                            <td className="px-2 py-1.5 tabular-nums text-ink">{p.size != null ? Math.round(p.size) : '—'}</td>
                            <td className="px-2 py-1.5 tabular-nums">{fmtMs(p.avg_execution_time_ms)}</td>
                            <td className="px-2 py-1.5 tabular-nums text-ink-muted">
                              {p.avg_join_count != null ? p.avg_join_count.toFixed(1) : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => void fetchGroupPage(rawId, 1)}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-contour text-ink-muted hover:text-ink hover:border-topo-6/40"
                                aria-label={`View queries in group ${formatGroupLabel(rawId)}`}
                                title={`View queries in group ${formatGroupLabel(rawId)}`}
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
            </div>
          ) : null}
        </div>
      </div>

      {activeGroupId ? (
        <div className="fixed inset-0 z-[70] bg-black/55 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-5xl max-h-[85vh] rounded-2xl border border-contour-strong bg-surface shadow-xl overflow-hidden flex flex-col">
            <div className="px-4 sm:px-5 py-3 border-b border-contour flex items-center justify-between gap-3">
              <div>
                <h4 className="font-body text-sm font-semibold text-ink">
                  Group {activeGroupId ? formatGroupLabel(activeGroupId) : '—'} queries
                </h4>
                <p className="font-body text-[11px] text-ink-faint">
                  {groupTotal.toLocaleString()} total · page {groupPage} of {Math.max(1, groupTotalPages)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-contour text-ink-muted hover:text-ink"
                aria-label="Close query list"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {groupLoading ? (
                <div className="py-12 flex flex-col items-center gap-2">
                  <div className="w-7 h-7 rounded-full border-2 border-contour border-t-topo-6 animate-spin" />
                  <span className="text-[11px] text-ink-faint">Loading page…</span>
                </div>
              ) : groupRows.length > 0 ? (
                <table className="w-full text-left text-[11px]">
                  <thead className="text-ink-faint sticky top-0 bg-surface border-b border-contour z-[1]">
                    <tr>
                      <th className="px-2 py-2 font-medium">#</th>
                      <th className="px-2 py-2 font-medium whitespace-nowrap" title="ml_optimization.query_logs.log_id">
                        log_id
                      </th>
                      <th className="px-2 py-2 font-medium" title="calls on this query_logs row">
                        Runs
                      </th>
                      <th
                        className="px-2 py-2 font-medium"
                        title="Mean ms per call for this row: total_exec_time_ms / calls when present, else mean_exec_time_ms"
                      >
                        Avg time
                      </th>
                      <th className="px-2 py-2 font-medium">Seen</th>
                      <th className="px-3 py-2 font-medium min-w-[35%]">Query sample</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupRows.map((row, idx) => (
                      <tr key={`${activeGroupId}-${groupPage}-${idx}`} className="border-t border-contour/50 align-top hover:bg-base/50">
                        <td className="px-2 py-1.5 text-ink-faint tabular-nums">{(groupPage - 1) * 10 + idx + 1}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px] text-topo-4 tabular-nums whitespace-nowrap">
                          {row.log_id != null ? (
                            <span title={row.query_hash ? `query_hash: ${row.query_hash}` : undefined}>{row.log_id}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-ink tabular-nums">
                          {row.calls_sum != null ? Math.round(row.calls_sum).toLocaleString() : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-ink-muted tabular-nums">{fmtMs(row.mean_exec_ms)}</td>
                        <td className="px-2 py-1.5 text-ink-muted whitespace-nowrap">
                          {row.collected_at ? formatLocalTime(row.collected_at) : '—'}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[10px] text-ink-soft break-all leading-snug">
                          {row.query_preview ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-10 text-center">
                  <p className="font-body text-xs text-ink-faint">{groupError ?? 'No records found for this group.'}</p>
                </div>
              )}
            </div>

            <div className="px-4 sm:px-5 py-3 border-t border-contour flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-body text-[11px] text-ink-faint">{groupError ?? '10 rows per page.'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void fetchGroupPage(activeGroupId, Math.max(1, groupPage - 1))}
                  disabled={groupLoading || groupPage <= 1}
                  className="inline-flex items-center gap-1 rounded-md border border-contour px-2.5 py-1 text-[11px] text-ink-muted hover:text-ink disabled:opacity-50"
                >
                  <ChevronLeft size={12} />
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => void fetchGroupPage(activeGroupId, groupPage + 1)}
                  disabled={groupLoading || groupPage >= groupTotalPages}
                  className="inline-flex items-center gap-1 rounded-md border border-contour px-2.5 py-1 text-[11px] text-ink-muted hover:text-ink disabled:opacity-50"
                >
                  Next
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
