import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, Database, Clock, FileText, Layers, XCircle, HelpCircle, X } from 'lucide-react';
import { formatLocalDateTime } from '../../utils/time';

interface DataFreshnessProps { data?: any; loading?: boolean; onRefetch?: () => void }

const PAGE_SIZE = 6;

const STATUS_LABEL: Record<string, string> = {
  fresh: 'Up to date',
  stale: 'Needs review',
  outdated: 'Update overdue',
  unknown: 'Unknown',
};

/** Build dataset rows from nested per-layer `freshness` object (legacy / fallback). */
function datasetsFromLayerFreshness(layerMap: Record<string, { tables?: Array<Record<string, unknown>> }> | undefined) {
  if (!layerMap || typeof layerMap !== 'object') return [];
  const out: Array<Record<string, unknown>> = [];
  for (const layer of ['bronze', 'silver', 'gold'] as const) {
    const tables = layerMap[layer]?.tables;
    if (!Array.isArray(tables)) continue;
    for (const t of tables) {
      const name = (t.table as string) ?? 'unknown';
      const status = (t.status as string) ?? 'unknown';
      const ha = t.hours_ago as number | null | undefined;
      const lastRel =
        ha == null
          ? '—'
          : ha < 24
            ? `${Math.floor(ha)}h ago`
            : `${Math.floor(ha / 24)}d ago`;
      out.push({
        name,
        layer,
        sla_lag: STATUS_LABEL[status] ?? status,
        last_updated: lastRel,
        last_updated_at: t.last_updated,
        records: (t.total_records as number) ?? 0,
        status,
        hours_ago: ha ?? null,
        activity_signal: t.activity_signal,
        source_column: t.source_column,
        reason_lines: Array.isArray(t.reason_lines) ? t.reason_lines : undefined,
      });
    }
  }
  return out;
}

/** Sort so SLA breach (outdated) first, then at-risk (stale), then fresh — so breach tables are visible on page 1 */
function sortBySeverity(datasets: Array<{ status?: string; [k: string]: unknown }>) {
  const order = { outdated: 0, stale: 1, unknown: 1.5, fresh: 2 };
  return [...datasets].sort((a, b) => (order[a?.status as keyof typeof order] ?? 2) - (order[b?.status as keyof typeof order] ?? 2));
}

function formatLastUpdatedLine(ds: {
  last_updated_at?: unknown;
  last_updated?: unknown;
  lastUpdated?: unknown;
  last_updated_iso?: unknown;
}) {
  const iso = ds.last_updated_at ?? ds.last_updated_iso;
  if (typeof iso === 'string' && iso.length > 4 && iso !== '—') {
    return formatLocalDateTime(iso);
  }
  const rel = ds.last_updated ?? ds.lastUpdated;
  return typeof rel === 'string' ? rel : '—';
}

function signalSummary(ds: Record<string, unknown>): string {
  const s = String(ds.activity_signal ?? '');
  const col = ds.source_column;
  if (s === 'etl') return 'Clock source: latest ETL completion (monitoring.job_runs)';
  if (s === 'column' && col != null && String(col)) return `Clock source: MAX(${String(col)}) on table rows`;
  if (s === 'pg_stat') return 'Clock source: pg_stat_user_tables (analyze / vacuum)';
  if (s === 'unknown') return 'Clock source: none — age unknown';
  return 'Clock source: —';
}

export default function DataFreshness({ data, loading, onRefetch }: DataFreshnessProps) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  /** Full JSON body from GET /monitoring/etl/freshness (includes `datasets`, `freshness` layers, counts). */
  const payload = data?.freshness;

  const freshMaxH = Number(payload?.sla_policy?.fresh_max_hours) > 0 ? Number(payload?.sla_policy?.fresh_max_hours) : 1;
  const staleMaxH = Number(payload?.sla_policy?.stale_max_hours) > 0 ? Number(payload?.sla_policy?.stale_max_hours) : 6;
  const policyDescription = typeof payload?.sla_policy?.description === 'string' ? payload.sla_policy.description : undefined;

  const rawDatasets = useMemo(() => {
    const fromList = Array.isArray(payload?.datasets) ? payload.datasets : [];
    if (fromList.length > 0) return fromList;
    const inner = payload?.freshness;
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      return datasetsFromLayerFreshness(inner as Record<string, { tables?: Array<Record<string, unknown>> }>);
    }
    return [];
  }, [payload]);

  const allDatasets = useMemo(() => sortBySeverity(rawDatasets), [rawDatasets]);

  const derivedOnTime = allDatasets.filter((d: any) => d?.status === 'fresh').length;
  const derivedAtRisk = allDatasets.filter((d: any) => d?.status === 'stale').length;
  const derivedBreach = allDatasets.filter((d: any) => d?.status === 'outdated').length;
  const derivedUnknown = allDatasets.filter((d: any) => d?.status === 'unknown').length;

  const serverHasCounts =
    payload &&
    typeof payload.on_time === 'number' &&
    typeof payload.at_risk === 'number' &&
    typeof payload.sla_breach === 'number' &&
    typeof payload.total_datasets === 'number';

  const onTime = serverHasCounts ? (payload!.on_time as number) : derivedOnTime;
  const atRisk = serverHasCounts ? (payload!.at_risk as number) : derivedAtRisk;
  const breach = serverHasCounts ? (payload!.sla_breach as number) : derivedBreach;
  const unknown =
    typeof payload?.unknown_datasets === 'number' ? payload.unknown_datasets : derivedUnknown;
  const total =
    typeof payload?.total_datasets === 'number' ? payload.total_datasets : allDatasets.length;

  const totalPages = total > 0 ? Math.max(1, Math.ceil(allDatasets.length / PAGE_SIZE)) : 1;
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const datasetList = allDatasets.slice(startIndex, startIndex + PAGE_SIZE);

  const summaryStats = [
    { label: 'Up to Date', value: String(onTime), icon: Clock, color: '#34d399' },
    { label: 'Needs Review', value: String(atRisk), icon: AlertTriangle, color: '#f59e0b' },
    { label: 'Update Overdue', value: String(breach), icon: FileText, color: '#f87171' },
    { label: 'Unknown', value: String(unknown), icon: HelpCircle, color: '#64748b' },
    { label: 'Total Datasets', value: String(total), icon: Layers, color: '#5a6a8a' },
  ];

  const selectedStatus = selected ? ((selected.status as string) ?? 'unknown') : '';
  const selectedStripe =
    selectedStatus === 'fresh'
      ? '#34d399'
      : selectedStatus === 'stale'
        ? '#f59e0b'
        : selectedStatus === 'outdated'
          ? '#f87171'
          : '#5a6a8a';

  return (
    <div className="bg-[#111628] rounded-2xl border border-[#1e2540] overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-body text-base font-bold text-white">Data Freshness & SLA</h3>
          {/* <p className="font-mono text-[10px] text-[#4a5a7a] tracking-wider mt-0.5 max-w-xl">
            Tracks how recently each table was updated and groups it into clear freshness categories so teams can prioritize follow-up quickly.
          </p> */}
        </div>
        <button type="button" onClick={() => onRefetch?.()} className="w-7 h-7 rounded-lg bg-[#0c0f1a] border border-[#1e2540] flex items-center justify-center text-[#4a5a7a] hover:text-[#c0cde0] transition-colors" aria-label="Refresh freshness">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Summary */}
      <div className="px-5 pb-4">
        <div className="flex flex-wrap gap-4 py-3 border-b border-[#1e2540]">
          {summaryStats.map((s: any) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-3 min-w-0 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}12` }}>
                  <Icon size={14} style={{ color: s.color }} />
                </div>
                <div className="min-w-0">
                  <span className="font-mono text-[8px] tracking-[0.2em] uppercase block" style={{ color: `${s.color}aa` }}>{s.label}</span>
                  <span className="font-body text-xl font-bold tabular-nums" style={{ color: s.value !== '0' ? s.color : '#5a6a8a' }}>{s.value}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dataset grid */}
      <div className="px-5 pb-4">
        {loading && allDatasets.length === 0 && (
          <div className="py-8 text-center font-body text-sm text-[#5a6a8a]">Loading freshness…</div>
        )}
        {!loading && allDatasets.length === 0 && (
          <div className="py-8 text-center font-body text-sm text-[#5a6a8a]">No dataset freshness data. Run ETL to populate.</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {datasetList.map((ds: any, i: number) => {
            const status = ds?.status ?? 'unknown';
            const isBreach = status === 'outdated';
            const stripeColor =
              status === 'fresh'
                ? '#34d399'
                : status === 'stale'
                  ? '#f59e0b'
                  : status === 'outdated'
                    ? '#f87171'
                    : '#5a6a8a';
            const displayName = ds?.layer ? `${ds.layer}.${ds.name}` : ds?.name;
            return (
            <motion.button
              type="button"
              key={`${ds?.layer ?? ''}-${ds?.name ?? i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 + 0.2 }}
              onClick={() => setSelected(ds)}
              className="bg-[#0c0f1a] rounded-xl p-4 border transition-all group cursor-pointer text-left relative overflow-hidden hover:border-[#2a3a60]"
              style={{ borderColor: isBreach ? 'rgba(248, 113, 113, 0.5)' : '#1e2540' }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${stripeColor}, transparent)` }} />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database size={13} className="text-[#3ecfff]" />
                  <span className="font-body text-sm font-semibold text-[#c0cde0]">{displayName}</span>
                  {isBreach && (
                    <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f87171]/20 text-[#f87171] border border-[#f87171]/40">
                      Update Overdue
                    </span>
                  )}
                </div>
                {status !== 'fresh' && (
                  status === 'outdated' ? (
                    <XCircle size={14} className="text-[#f87171]" aria-label="Update overdue" />
                  ) : status === 'stale' ? (
                    <AlertTriangle size={14} className="text-[#f59e0b]" aria-label="Needs review" />
                  ) : (
                    <HelpCircle size={14} className="text-[#5a6a8a]" aria-label="Unknown" />
                  )
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-[#4a5a7a] tracking-wider">SLA Lag</span>
                  <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: stripeColor, background: `${stripeColor}15`, border: `1px solid ${stripeColor}40` }}>{ds?.slaLag ?? ds?.sla_lag ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] text-[#4a5a7a] tracking-wider shrink-0">Last activity</span>
                  <span
                    className="font-mono text-[10px] text-[#7a8aaa] text-right break-words leading-tight max-w-[65%]"
                    title={typeof ds?.last_updated_at === 'string' ? ds.last_updated_at : undefined}
                  >
                    {formatLastUpdatedLine(ds)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-[#4a5a7a] tracking-wider">Records</span>
                  <span className="font-mono text-[10px] text-[#c0cde0] font-semibold">
                    {typeof (ds?.records ?? ds?.record_count) === 'number'
                      ? Number(ds?.records ?? ds?.record_count).toLocaleString()
                      : (ds?.records ?? ds?.record_count ?? '—')}
                  </span>
                </div>
              </div>
              <p className="font-mono text-[8px] text-[#4a5a7a] mt-2">Click for the reason behind this status</p>
            </motion.button>
          );})}
        </div>
      </div>

      {allDatasets.length > PAGE_SIZE && (
        <div className="px-5 pb-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="font-mono text-[10px] px-3 py-1.5 rounded-lg border border-[#1e2540] text-[#5a6a8a] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#0c0f1a] hover:text-[#c0cde0] hover:border-[#2a3a60] transition-all"
          >
            Prev
          </button>
          <span className="font-mono text-[10px] text-[#5a6a8a]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="font-mono text-[10px] px-3 py-1.5 rounded-lg border border-[#1e2540] text-[#5a6a8a] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#0c0f1a] hover:text-[#c0cde0] hover:border-[#2a3a60] transition-all"
          >
            Next
          </button>
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              key={`${String(selected.layer)}-${String(selected.name)}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-[#1e2540] bg-[#0c0f1a] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1" style={{ background: `linear-gradient(90deg, transparent, ${selectedStripe}, transparent)` }} />
              <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-[#1e2540]">
                <div>
                  <h4 className="font-body text-base font-bold text-white flex items-center gap-2">
                    <Database size={16} className="text-[#3ecfff]" />
                    {selected.layer ? `${String(selected.layer)}.${String(selected.name)}` : String(selected.name)}
                  </h4>
                  <p className="font-mono text-[10px] text-[#6a7a9a] mt-1">
                    Status: <span style={{ color: selectedStripe }}>{STATUS_LABEL[selectedStatus] ?? selectedStatus}</span>
                    {typeof selected.hours_ago === 'number' && (
                      <> · {Number(selected.hours_ago).toFixed(2)}h since activity</>
                    )}
                  </p>
                  <p className="font-mono text-[9px] text-[#8a9aba] mt-1.5 leading-snug">{signalSummary(selected)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="p-2 rounded-lg hover:bg-[#111628] text-[#5a6a8a] hover:text-[#c0cde0]"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-5 py-4 max-h-[min(70vh,420px)] overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px] text-[#7a8aaa]">
                  <div className="bg-[#111628] rounded-lg p-2 border border-[#1e2540]">
                    <span className="text-[#4a5a7a] block">Last activity (display)</span>
                    {formatLastUpdatedLine(selected as any)}
                  </div>
                  <div className="bg-[#111628] rounded-lg p-2 border border-[#1e2540]">
                    <span className="text-[#4a5a7a] block">Records (estimate)</span>
                    {typeof selected.records === 'number' ? selected.records.toLocaleString() : '—'}
                  </div>
                </div>
                {typeof selected.last_updated_at === 'string' && selected.last_updated_at.length > 4 && (
                  <p className="font-mono text-[9px] text-[#5a6a8a] break-all">
                    Raw timestamp: {String(selected.last_updated_at)}
                  </p>
                )}
                <details className="group border border-[#1e2540] rounded-lg bg-[#111628]/60">
                  <summary className="font-mono text-[10px] text-[#6a7a9a] cursor-pointer px-3 py-2 hover:text-[#a0b0c8] list-none flex items-center gap-2">
                    <span className="opacity-60 group-open:rotate-90 transition-transform">▸</span>
                    How freshness works (same rules for every table)
                  </summary>
                  <div className="px-3 pb-3 pt-0 space-y-2 font-mono text-[10px] text-[#7a8aaa] leading-relaxed border-t border-[#1e2540]">
                    {policyDescription ? <p>{policyDescription}</p> : null}
                    <p>
                      Priority when picking the clock: (1) ETL completion time for this table, (2) first matching
                      timestamp column with a MAX value, (3) latest PostgreSQL maintenance time on the table.
                    </p>
                    <p>
                      Freshness bands: Up to date if age &lt; {freshMaxH}h · Needs review if {freshMaxH}h–{staleMaxH}h · Update overdue if ≥ {staleMaxH}h.
                    </p>
                  </div>
                </details>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

