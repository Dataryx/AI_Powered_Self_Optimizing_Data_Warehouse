import { motion } from 'framer-motion';
import { RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { formatLocalDateTime } from '../../utils/time';

interface ErrorsRetriesProps { data?: any; loading?: boolean; onRefetch?: () => void }

export default function ErrorsRetries({ data, loading, onRefetch }: ErrorsRetriesProps) {
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  const hasErrors = errors.length > 0;

  return (
    <div className="bg-[#111628] rounded-2xl border border-[#1e2540] overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h3 className="font-body text-base font-bold text-white">Errors & Retries</h3>
        <button type="button" onClick={() => onRefetch?.()} className="w-7 h-7 rounded-lg bg-[#0c0f1a] border border-[#1e2540] flex items-center justify-center text-[#4a5a7a] hover:text-[#c0cde0] transition-colors" aria-label="Refresh errors">
          <RefreshCw size={12} />
        </button>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="px-5 pb-8">
        {loading && !hasErrors && (
          <div className="py-10 text-center font-body text-sm text-[#5a6a8a]">Loading errors…</div>
        )}
        {!loading && hasErrors ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {errors.slice(0, 10).map((err: any, i: number) => (
              <div key={err?.error_id ?? i} className="flex items-start gap-2 bg-[#3a1a1a40] border border-[#5c1a1a60] rounded-xl p-3">
                <XCircle size={14} className="text-[#f87171] flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  {(err?.table || err?.severity) && (
                    <span className="font-mono text-[9px] text-[#7a8aaa] block mb-0.5">
                      {[err.table, err.severity].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  <span className="font-body text-sm text-[#c0cde0]">{err?.message ?? err?.error_message ?? 'Error'}</span>
                  <span className="font-mono text-[10px] text-[#4a5a7a] block mt-0.5">
                    {formatLocalDateTime(err?.timestamp ?? err?.occurred_at) !== '—'
                      ? formatLocalDateTime(err?.timestamp ?? err?.occurred_at)
                      : (err?.job_id ?? '')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : !loading ? (
          <div className="relative bg-[#0d3a2a40] border border-[#1a5c4060] rounded-xl py-10 flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(52,211,153,0.02) 3px, rgba(52,211,153,0.02) 4px)' }} />
            <div className="relative flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-[#0d3a2a] border border-[#1a5c40] flex items-center justify-center mb-3">
                <ShieldCheck size={26} className="text-[#34d399]" />
              </div>
              <span className="font-body text-base font-semibold text-[#c0cde0] mb-0.5">No Active Errors</span>
              <span className="font-mono text-[10px] text-[#34d399] tracking-wider">All ETL processes are running smoothly</span>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
