import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { api } from '../../services/api';

interface ThroughputBannerProps { data?: any; loading?: boolean }

export default function ThroughputBanner({ data, loading }: ThroughputBannerProps) {
  const tp = data?.throughput;
  // API returns { throughput: [...], overall_throughput: number }; also support flat records_per_second
  const recordsPerSec =
    tp?.overall_throughput ??
    tp?.records_per_second ??
    tp?.records_per_sec ??
    (Array.isArray(tp?.throughput) && tp.throughput.length > 0
      ? tp.throughput.reduce((s: number, t: any) => s + (Number(t?.records_per_second) || 0), 0)
      : undefined);
  const bytesPerSec = tp?.bytes_per_second ?? tp?.bytes_per_sec;
  const hasData = recordsPerSec != null || bytesPerSec != null;

  const [jobDefs, setJobDefs] = useState<any[]>([]);
  const [selectedJobName, setSelectedJobName] = useState<string>('Complete ETL Pipeline');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const effectiveJobDefs = useMemo(() => {
    if (jobDefs?.length) return jobDefs;
    // Fallback so the UI always provides a way to run.
    return [{ job_name: 'Complete ETL Pipeline', job_type: 'pipeline' }];
  }, [jobDefs]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.getETLJobDefinitions();
        if (!mounted) return;
        const next = (res?.jobs || []) as any[];
        setJobDefs(next);
        const preferred =
          next.find((j: any) => j?.job_name === 'Complete ETL Pipeline')?.job_name ||
          next[0]?.job_name ||
          'Complete ETL Pipeline';
        setSelectedJobName(preferred);
      } catch {
        // Ignore; we'll use fallback jobs
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="bg-[#111628] rounded-2xl border border-[#1e2540] px-5 py-10 flex flex-col items-center justify-center relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, #1e2540 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      <div className="relative flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-[#0c0f1a] border border-[#1e2540] flex items-center justify-center mb-3">
          <BarChart3 size={18} className="text-[#3a4a6a]" />
        </div>
        {!hasData && (
          <div className="flex flex-col items-center gap-3">
            <span className="font-body text-sm text-[#5a6a8a]">
              Run ETL to populate throughput metrics.
            </span>

            <select
              className="font-body text-xs bg-[#0c0f1a] border border-[#1e2540] text-[#c0cde0] rounded-lg px-3 py-2 outline-none"
              value={selectedJobName}
              onChange={(e) => setSelectedJobName(e.target.value)}
              disabled={running}
            >
              {effectiveJobDefs.map((j: any) => (
                <option key={j?.job_id || j?.job_name} value={j?.job_name}>
                  {j?.job_name}
                </option>
              ))}
            </select>

            <button
              className="mt-1 px-4 py-2 rounded-lg bg-[#3ecfff12] border border-[#1e2540] text-[#e0e8f5] hover:bg-[#3ecfff18] disabled:opacity-60"
              disabled={running || !selectedJobName}
              onClick={async () => {
                setRunError(null);
                setRunning(true);
                try {
                  await api.runETLJob(selectedJobName);
                } catch (err: any) {
                  setRunError(err?.message || 'Failed to start ETL job');
                } finally {
                  setRunning(false);
                }
              }}
            >
              {running ? 'Running…' : 'Run ETL'}
            </button>

            {runError && (
              <span className="font-mono text-[10px] text-red-400 text-center">
                {runError}
              </span>
            )}
          </div>
        )}
        {!loading && hasData && (
          <div className="flex flex-col items-center gap-1">
            <span className="font-body text-xl font-bold text-[#c0cde0]">{Number(recordsPerSec ?? 0).toLocaleString()} rec/s</span>
            <span className="font-mono text-[10px] text-[#4a5a7a]">{bytesPerSec != null ? `${(Number(bytesPerSec) / 1e6).toFixed(1)} MB/s` : ''}</span>
          </div>
        )}
        {!loading && !hasData && (
          <span className="font-body text-sm text-[#5a6a8a]">No throughput data yet.</span>
        )}
      </div>
    </motion.div>
  );
}
