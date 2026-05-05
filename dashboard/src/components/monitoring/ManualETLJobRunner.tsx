import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, AlertCircle, ChevronDown, Loader2, Zap } from 'lucide-react';
import { api } from '../../services/api';
import { formatLocalDateTime } from '../../utils/time';

type JobDef = {
  job_id?: string;
  job_name?: string;
  job_type?: string;
};

type JobRunRow = {
  job_id?: string;
  job_name?: string;
  job_type?: string;
  status?: string;
  progress?: number;
  layer?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
};

const PIPELINE_STEPS = ['Extract', 'Transform', 'Load'] as const;

type DisplayStatus = 'Idle' | 'Running' | 'Failed' | 'Completed';

type ManualETLJobRunnerProps = {
  onAfterDispatch?: () => void;
  /** Latest-first runs from GET /monitoring/etl/jobs */
  jobs?: JobRunRow[];
  jobsLoading?: boolean;
  /** When provided with definitionsLoading, skips a duplicate GET /monitoring/etl/job-definitions on mount (parent batch-loads). */
  jobDefinitions?: JobDef[];
  definitionsLoading?: boolean;
};

function normName(s: string): string {
  return s.trim().toLowerCase();
}

type RunSemantic = 'success' | 'failure' | 'running' | 'neutral';

function classifyStatus(statusRaw: string): RunSemantic {
  const s = statusRaw.trim().toLowerCase();
  if (s === 'completed' || s === 'success' || s === 'succeeded') return 'success';
  if (s === 'failed' || s === 'error' || s === 'cancelled' || s === 'canceled') return 'failure';
  if (s === 'running' || s === 'in_progress' || s === 'processing' || s === 'pending' || s === 'queued')
    return 'running';
  return 'neutral';
}

function lastRunForJobName(runs: JobRunRow[] | undefined, jobName: string): JobRunRow | null {
  if (!runs?.length || !jobName) return null;
  const want = normName(jobName);
  const match = runs.find((r) => normName(String(r?.job_name ?? '')) === want);
  return match ?? null;
}

function displayStatusForRun(lastRun: JobRunRow | null): DisplayStatus {
  if (!lastRun) return 'Idle';
  const sem = classifyStatus(String(lastRun.status ?? ''));
  if (sem === 'running') return 'Running';
  if (sem === 'failure') return 'Failed';
  if (sem === 'success') return 'Completed';
  return 'Idle';
}

function clampProgress(p: unknown): number {
  const n = typeof p === 'number' ? p : Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Maps run to ETL stage labels (Extract → Transform → Load). */
function pipelineStageUi(
  lastRun: JobRunRow | null,
  selectedJobType: string | undefined,
): {
  showStages: boolean;
  activeIndex: number;
  currentStepLabel: string;
} {
  const jt = String(lastRun?.job_type ?? selectedJobType ?? '').toLowerCase();
  if (!lastRun) {
    return { showStages: jt === 'pipeline', activeIndex: -1, currentStepLabel: '' };
  }
  const showStages = jt === 'pipeline' || Boolean(lastRun.layer);
  if (!showStages) {
    return { showStages: false, activeIndex: -1, currentStepLabel: '' };
  }

  const meta = lastRun.metadata;
  const fromMeta =
    meta && typeof meta.pipeline_stage === 'string' ? String(meta.pipeline_stage).trim() : '';
  if (fromMeta) {
    const idx = PIPELINE_STEPS.findIndex((s) => s.toLowerCase() === fromMeta.toLowerCase());
    if (idx >= 0) return { showStages: true, activeIndex: idx, currentStepLabel: PIPELINE_STEPS[idx] };
  }

  const st = String(lastRun.status ?? '');
  const running = classifyStatus(st) === 'running';
  const p = clampProgress(lastRun.progress);

  if (jt === 'pipeline' && running) {
    if (p < 50) return { showStages: true, activeIndex: 1, currentStepLabel: 'Transform' };
    return { showStages: true, activeIndex: 2, currentStepLabel: 'Load' };
  }

  if (running && lastRun.layer) {
    const L = String(lastRun.layer).toLowerCase();
    if (L === 'bronze') return { showStages: true, activeIndex: 0, currentStepLabel: 'Extract' };
    if (L === 'silver') return { showStages: true, activeIndex: 1, currentStepLabel: 'Transform' };
    if (L === 'gold') return { showStages: true, activeIndex: 2, currentStepLabel: 'Load' };
  }

  if (running) return { showStages: true, activeIndex: 0, currentStepLabel: 'Extract' };

  return { showStages, activeIndex: -1, currentStepLabel: '' };
}

export default function ManualETLJobRunner({
  onAfterDispatch,
  jobs = [],
  jobsLoading = false,
  jobDefinitions: jobDefinitionsFromParent,
  definitionsLoading: definitionsLoadingFromParent,
}: ManualETLJobRunnerProps) {
  const parentOwnsDefinitions = definitionsLoadingFromParent !== undefined;
  const [jobDefs, setJobDefs] = useState<JobDef[]>([]);
  const [selectedJobName, setSelectedJobName] = useState<string>('Complete ETL Pipeline');
  const [loadingJobs, setLoadingJobs] = useState(!parentOwnsDefinitions);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [polledJobs, setPolledJobs] = useState<JobRunRow[] | null>(null);

  const effectiveJobDefs = useMemo(() => {
    const fromParent = jobDefinitionsFromParent;
    if (parentOwnsDefinitions && Array.isArray(fromParent) && fromParent.length > 0) return fromParent;
    if (jobDefs?.length) return jobDefs;
    return [{ job_name: 'Complete ETL Pipeline', job_type: 'pipeline' }];
  }, [jobDefs, jobDefinitionsFromParent, parentOwnsDefinitions]);

  const mergedJobs = polledJobs ?? jobs;
  const lastRun = useMemo(
    () => lastRunForJobName(mergedJobs, selectedJobName),
    [mergedJobs, selectedJobName],
  );

  const selectedJobType = useMemo(
    () => effectiveJobDefs.find((j) => j?.job_name === selectedJobName)?.job_type,
    [effectiveJobDefs, selectedJobName],
  );

  useEffect(() => {
    const lr = lastRunForJobName(jobs, selectedJobName);
    const isRunning = lr && classifyStatus(String(lr.status ?? '')) === 'running';
    if (!isRunning) {
      setPolledJobs(null);
      return;
    }
    let cancelled = false;
    const applyList = (list: JobRunRow[]) => {
      if (cancelled) return;
      setPolledJobs(list);
    };
    const tick = async () => {
      try {
        const r = (await api.getETLJobs()) as { jobs?: JobRunRow[] };
        applyList((r?.jobs ?? []) as JobRunRow[]);
      } catch {
        /* ignore transient errors while polling */
      }
    };
    void api.getETLJobs().then((r) => {
      applyList(((r as { jobs?: JobRunRow[] })?.jobs ?? []) as JobRunRow[]);
    });
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [jobs, selectedJobName]);

  const liveStatus = displayStatusForRun(lastRun);
  const progressPct = clampProgress(lastRun?.progress);
  const stageUi = pipelineStageUi(lastRun, selectedJobType);
  const showProgressTrack =
    Boolean(lastRun) &&
    (liveStatus === 'Running' || liveStatus === 'Completed' || liveStatus === 'Failed');
  const barPercent =
    liveStatus === 'Completed' ? 100 : liveStatus === 'Failed' ? Math.max(progressPct, 5) : progressPct;
  const showStepRow = stageUi.showStages;

  const lastRunUi = useMemo(() => {
    if (!lastRun) return null;
    const sem = classifyStatus(String(lastRun.status ?? ''));
    const st = String(lastRun.status ?? '—');

    let atIso: string | null = null;
    let atLabel = '';
    if (sem === 'running') {
      atIso = lastRun.started_at ?? null;
      atLabel = 'Started';
    } else if (sem === 'success') {
      atIso = lastRun.completed_at ?? lastRun.started_at ?? null;
      atLabel = 'Completed';
    } else if (sem === 'failure') {
      atIso = lastRun.completed_at ?? lastRun.started_at ?? null;
      atLabel = 'Ended';
    } else {
      atIso = lastRun.completed_at ?? lastRun.started_at ?? null;
      atLabel = 'Updated';
    }

    const atDisplay = atIso ? formatLocalDateTime(atIso) : '—';

    const styles: Record<RunSemantic, { border: string; bg: string; text: string; dot: string }> = {
      success: {
        border: 'border-[#34d399]/35',
        bg: 'bg-[#34d399]/[0.07]',
        text: 'text-[#34d399]',
        dot: 'bg-[#34d399]',
      },
      failure: {
        border: 'border-[#f87171]/40',
        bg: 'bg-[#f87171]/[0.08]',
        text: 'text-[#f87171]',
        dot: 'bg-[#f87171]',
      },
      running: {
        border: 'border-[#fbbf24]/45',
        bg: 'bg-[#fbbf24]/[0.08]',
        text: 'text-[#fbbf24]',
        dot: 'bg-[#fbbf24] animate-pulse',
      },
      neutral: {
        border: 'border-[#1e2540]',
        bg: 'bg-[#0c0f1a]',
        text: 'text-[#a0b0c8]',
        dot: 'bg-[#5a6a8a]',
      },
    };

    return { sem, st, atLabel, atDisplay, ...styles[sem] };
  }, [lastRun]);

  useEffect(() => {
    if (parentOwnsDefinitions) {
      setLoadingJobs(Boolean(definitionsLoadingFromParent));
      if (definitionsLoadingFromParent || !Array.isArray(jobDefinitionsFromParent)) {
        return;
      }
      const nextJobs = jobDefinitionsFromParent;
      setJobDefs(nextJobs);
      setSelectedJobName((cur) => {
        if (nextJobs.some((j) => j?.job_name === cur)) return cur;
        return (
          nextJobs.find((j) => j?.job_name === 'Complete ETL Pipeline')?.job_name ||
          nextJobs[0]?.job_name ||
          'Complete ETL Pipeline'
        );
      });
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setRunError(null);
        setLoadingJobs(true);
        const res = await api.getETLJobDefinitions();
        if (!mounted) return;
        const nextJobs: JobDef[] = (res?.jobs || []) as JobDef[];
        setJobDefs(nextJobs);

        const preferred =
          nextJobs.find((j) => j?.job_name === 'Complete ETL Pipeline')?.job_name ||
          nextJobs[0]?.job_name ||
          'Complete ETL Pipeline';
        setSelectedJobName(preferred);
      } catch (e) {
        if (!mounted) return;
        setRunError(e instanceof Error ? e.message : 'Failed to load ETL jobs');
      } finally {
        if (mounted) setLoadingJobs(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    parentOwnsDefinitions,
    definitionsLoadingFromParent,
    jobDefinitionsFromParent,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.32, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="bg-[#111628] rounded-2xl border border-[#1e2540] overflow-hidden h-full flex flex-col"
    >
      <div className="px-5 pt-5 pb-3 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-[#3ecfff12] border border-[#3ecfff25] flex items-center justify-center shrink-0">
          <Zap size={16} className="text-[#3ecfff]" strokeWidth={1.6} aria-hidden />
        </div>
        <h3 className="font-body text-base font-bold text-white">Run ETL manually</h3>
      </div>

      <div className="px-5 pb-5 flex flex-col flex-1 min-h-0 gap-3">
        <label htmlFor="manual-etl-job" className="sr-only">
          Job
        </label>
        <div className="flex flex-col gap-2 shrink-0">
          <div className="relative w-full min-w-0">
            <select
              id="manual-etl-job"
              className="w-full cursor-pointer appearance-none rounded-xl border border-[#1e2540] bg-[#0c0f1a] py-2.5 pl-3 pr-10 font-body text-sm text-[#c0cde0] outline-none transition-colors hover:border-[#2a3a60] focus:border-[#3ecfff]/35 focus:ring-1 focus:ring-[#3ecfff]/20 disabled:cursor-not-allowed disabled:opacity-55"
              value={selectedJobName}
              disabled={running || loadingJobs || (parentOwnsDefinitions && Boolean(definitionsLoadingFromParent))}
              onChange={(e) => setSelectedJobName(String(e.target.value))}
            >
              {effectiveJobDefs.map((j) => (
                <option key={j?.job_id || j?.job_name} value={j?.job_name}>
                  {j?.job_name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6a8a]"
              aria-hidden
            />
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-[#1e2540] bg-[#3ecfff12] px-3 py-2 font-mono text-[11px] font-bold tracking-wider text-[#c0cde0] hover:bg-[#3ecfff18] hover:border-[#2a3a60] transition-colors disabled:pointer-events-none disabled:opacity-50"
            disabled={
              running ||
              !selectedJobName ||
              loadingJobs ||
              (parentOwnsDefinitions && Boolean(definitionsLoadingFromParent))
            }
            onClick={async () => {
              setRunError(null);
              setRunning(true);
              try {
                const res = await api.runETLJob(selectedJobName);

                if (res?.status !== 'started') {
                  if (res?.status === 'already_running') {
                    const runningSince = res?.running_started_at
                      ? ` since ${formatLocalDateTime(res.running_started_at)}`
                      : '';
                    const runId = res?.running_job_run_id ? ` (run_id: ${res.running_job_run_id})` : '';
                    setRunError(`ETL job not started: already_running${runningSince}${runId}`);
                  } else {
                    setRunError(`ETL job not started: ${res?.status || 'unknown'}`);
                  }
                }

                onAfterDispatch?.();
              } catch (err: unknown) {
                setRunError(err instanceof Error ? err.message : 'Failed to start ETL job');
              } finally {
                setRunning(false);
              }
            }}
          >
            {running ? (
              <Loader2 size={13} className="animate-spin text-[#3ecfff]" aria-hidden />
            ) : (
              <Play size={13} className="text-[#3ecfff]" aria-hidden />
            )}
            <span>{running ? '…' : 'Run'}</span>
          </button>
        </div>

        <div
          className="rounded-xl border border-[#1e2540] bg-[#0c0f1a] px-3 py-3 space-y-2.5 shrink-0"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] text-[#5a6a8a] uppercase tracking-wider">
              Current status
            </span>
            <span
              className={`font-mono text-[10px] font-bold tracking-wide ${
                liveStatus === 'Idle'
                  ? 'text-[#5a6a8a]'
                  : liveStatus === 'Running'
                    ? 'text-[#fbbf24]'
                    : liveStatus === 'Failed'
                      ? 'text-[#f87171]'
                      : 'text-[#34d399]'
              }`}
            >
              {liveStatus}
            </span>
          </div>

          {showProgressTrack && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-[#111628] border border-[#1e2540] overflow-hidden">
                <div
                  className={[
                    'h-full rounded-full transition-[width] duration-500 ease-out',
                    liveStatus === 'Completed'
                      ? 'bg-[#34d399]'
                      : liveStatus === 'Failed'
                        ? 'bg-[#f87171]'
                        : 'bg-[#3ecfff]',
                  ].join(' ')}
                  style={{ width: `${barPercent}%` }}
                />
              </div>
              <p className="font-mono text-[10px] text-[#6a7a92] tabular-nums">
                {(() => {
                  const segs = 10;
                  const filled = Math.min(segs, Math.max(0, Math.round(barPercent / 10)));
                  return `[${'█'.repeat(filled)}${'░'.repeat(segs - filled)}] ${barPercent}%`;
                })()}
              </p>
            </div>
          )}

          {showStepRow && (
            <div className="space-y-1.5 pt-0.5">
              <p className="font-mono text-[8px] text-[#4a5a72] uppercase tracking-wider">
                Pipeline stages
              </p>
              <div className="flex flex-wrap items-center gap-x-1 gap-y-1 font-mono text-[10px]">
                {PIPELINE_STEPS.map((label, i) => {
                  const isDone =
                    liveStatus === 'Completed' ||
                    (liveStatus === 'Running' &&
                      stageUi.activeIndex >= 0 &&
                      i < stageUi.activeIndex) ||
                    (liveStatus === 'Failed' && stageUi.activeIndex >= 0 && i < stageUi.activeIndex);
                  const isActive =
                    liveStatus === 'Running' && stageUi.activeIndex === i && stageUi.activeIndex >= 0;
                  const isFail =
                    liveStatus === 'Failed' && stageUi.activeIndex === i && stageUi.activeIndex >= 0;
                  return (
                    <span key={label} className="inline-flex items-center gap-1">
                      {i > 0 ? (
                        <span className="text-[#2a3555] px-0.5" aria-hidden>
                          →
                        </span>
                      ) : null}
                      <span
                        className={[
                          'px-2 py-0.5 rounded-md border transition-colors',
                          liveStatus === 'Idle' && 'border-[#1e2540] text-[#3a4a6a] bg-transparent',
                          isDone && 'border-[#34d399]/35 text-[#6ee7b7]/90 bg-[#34d399]/[0.08]',
                          isActive && 'border-[#3ecfff]/45 text-[#3ecfff] bg-[#3ecfff]/[0.12] shadow-[0_0_12px_rgba(62,207,255,0.12)]',
                          isFail && 'border-[#f87171]/45 text-[#f87171] bg-[#f87171]/[0.1]',
                          !isDone &&
                            !isActive &&
                            !isFail &&
                            liveStatus === 'Running' &&
                            'border-[#1e2540] text-[#3a4a6a]',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {label}
                      </span>
                    </span>
                  );
                })}
              </div>
              {liveStatus === 'Running' && stageUi.currentStepLabel ? (
                <p className="font-mono text-[10px] text-[#a0b0cc]">
                  <span className="text-[#5a6a8a]">Current step: </span>
                  <span className="text-[#3ecfff] font-semibold">{stageUi.currentStepLabel}</span>
                </p>
              ) : null}
              {liveStatus === 'Failed' && lastRun?.error_message ? (
                <p className="font-mono text-[9px] text-[#f87171]/90 leading-snug line-clamp-2">
                  {String(lastRun.error_message)}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {runError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 shrink-0"
            role="alert"
          >
            <AlertCircle size={14} className="shrink-0 text-red-400 mt-0.5" aria-hidden />
            <p className="font-mono text-[11px] leading-snug text-red-400">{runError}</p>
          </motion.div>
        )}

        <div className="mt-auto shrink-0 pt-3 border-t border-[#1e2540]">
          {jobsLoading && !jobs.length ? (
            <p className="font-mono text-[8px] text-[#5a6a8a] leading-tight">Loading last run…</p>
          ) : lastRunUi ? (
            <div
              className={`max-w-full rounded-md border px-2 py-1 ${lastRunUi.border} ${lastRunUi.bg}`}
              role="status"
              aria-label={`Last run ${lastRunUi.st}, ${lastRunUi.atLabel} ${lastRunUi.atDisplay}`}
            >
              <p className="font-mono text-[8px] leading-snug text-[#6a7a92]">
                <span className="text-[#4a5a72]">Last · </span>
                <span className={`inline-flex items-center gap-0.5 font-bold uppercase ${lastRunUi.text}`}>
                  <span className={`h-1 w-1 rounded-full shrink-0 ${lastRunUi.dot}`} aria-hidden />
                  {lastRunUi.st}
                </span>
                <span className="text-[#3a4a62] mx-0.5">·</span>
                <span className="tabular-nums text-[#8a9ab0]">{lastRunUi.atDisplay}</span>
              </p>
            </div>
          ) : (
            <p className="font-mono text-[8px] text-[#5a6a8a] leading-tight">No runs recorded for this job.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
