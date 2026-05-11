import { motion } from 'framer-motion';
import { Clock, Radio, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { formatLocalDateTime } from '../../utils/time';

interface RecentETLRunsProps { data?: any; loading?: boolean; onRefetch?: () => void }

function runStatusIcon(statusRaw: unknown) {
  const s = String(statusRaw ?? '').trim().toLowerCase();
  if (s === 'completed') return <CheckCircle size={14} className="text-[#34d399]" />;
  if (s === 'failed' || s === 'error') return <XCircle size={14} className="text-[#f87171]" />;
  return <Clock size={14} className="text-[#fbbf24]" />;
}

export default function RecentETLRuns({ data, loading, onRefetch }: RecentETLRunsProps) {
  const jobs = Array.isArray(data?.jobs) ? data.jobs.slice(0, 10) : [];
  const hasRuns = jobs.length > 0;

  return (
    <div className="bg-[#111628] rounded-2xl border border-[#1e2540] overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-body text-base font-bold text-white">Recent ETL Runs</h3>
          <p className="font-mono text-[10px] text-[#4a5a7a] tracking-wider mt-0.5">All history</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#0d3a2a] border border-[#1a5c40]">
            <Radio size={9} className="text-[#34d399]" />
            <span className="font-mono text-[8px] text-[#34d399] font-bold tracking-widest">Live</span>
          </div>
          <button type="button" onClick={() => onRefetch?.()} className="w-7 h-7 rounded-lg bg-[#0c0f1a] border border-[#1e2540] flex items-center justify-center text-[#4a5a7a] hover:text-[#c0cde0] transition-colors" aria-label="Refresh ETL runs">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>
      {loading && !hasRuns && (
        <div className="px-5 pb-5 flex flex-col items-center justify-center py-14">
          <div className="w-20 h-20 rounded-full border-2 border-[#1e2540] border-t-[#3ecfff] animate-spin" />
          <span className="font-body text-sm text-[#5a6a8a] mt-3">Loading runs…</span>
        </div>
      )}
      {!loading && hasRuns && (
        <div className="px-5 pb-5 space-y-2 max-h-64 overflow-y-auto">
          {jobs.map((j: any, i: number) => (
            <motion.div
              key={j?.job_id ?? i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between bg-[#0c0f1a] rounded-xl p-3 border border-[#1e2540]"
            >
              <div className="flex items-center gap-2">
                {runStatusIcon(j?.status)}
                <span className="font-mono text-[11px] text-[#c0cde0]">
                  {j?.job_name ?? j?.job_type ?? 'Run'}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-[10px] text-[#4a5a7a]">{j?.status ?? '—'}</span>
                <span className="font-mono text-[10px] text-[#5a6a8a]">
                  {j?.completed_at
                    ? formatLocalDateTime(j.completed_at)
                    : String(j?.status ?? '').toLowerCase() === 'running'
                      ? 'In progress'
                      : '—'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {!loading && !hasRuns && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-col items-center justify-center py-14 px-5">
          <div className="relative w-20 h-20 mb-4">
            <div className="absolute inset-0 rounded-full border border-[#1e2540]" />
            <div className="absolute inset-2 rounded-full border border-dashed border-[#1e2540]" />
            <div className="absolute inset-4 rounded-full border border-[#1e2540]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Clock size={18} className="text-[#3a4a6a]" />
            </div>
          </div>
          <span className="font-body text-sm text-[#5a6a8a]">No recent pipeline runs</span>
        </motion.div>
      )}
    </div>
  );
}
