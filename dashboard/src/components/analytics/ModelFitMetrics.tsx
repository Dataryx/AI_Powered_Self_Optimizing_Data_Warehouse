import { motion } from 'framer-motion';
import { Brain, RefreshCw, Info } from 'lucide-react';
import type { MlModelMetricsPayload } from '../../hooks/useMlModelMetrics';

function fmtUnit(n: number | undefined, kind: 'r2' | 'ms'): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (kind === 'r2') {
    const pct = n * 100;
    return `${pct.toFixed(1)}%`;
  }
  if (Math.abs(n) >= 1000) return `${n.toFixed(0)} ms`;
  if (Math.abs(n) >= 10) return `${n.toFixed(2)} ms`;
  return `${n.toFixed(3)} ms`;
}

interface ModelFitMetricsProps {
  data: MlModelMetricsPayload | null;
  loading?: boolean;
  onRefresh?: () => void;
}

const MIN_TARGET_ACCURACY_PCT = 90;

export default function ModelFitMetrics({ data, loading, onRefresh }: ModelFitMetricsProps) {
  const qp = data?.query_time_predictor;
  const m = qp?.metrics;
  const hasMetrics = m && Object.keys(m).length > 0;
  const testR2 = typeof m?.test_r2 === 'number' ? m.test_r2 : undefined;
  const testAccuracyPct = testR2 != null && Number.isFinite(testR2) ? testR2 * 100 : undefined;
  const meetsTarget = testAccuracyPct != null ? testAccuracyPct >= MIN_TARGET_ACCURACY_PCT : null;

  const rows: Array<{
    label: string;
    key: string;
    kind: 'r2' | 'ms';
    help: string;
  }> = [
    { label: 'Overall accuracy (test R²)', key: 'test_r2', kind: 'r2', help: 'Coefficient of determination on held-out test data (higher is better).' },
    { label: 'Average prediction gap (MAE)', key: 'test_mae', kind: 'ms', help: 'Mean absolute error on test data, in milliseconds.' },
    { label: 'Large miss sensitivity (RMSE)', key: 'test_rmse', kind: 'ms', help: 'Root mean squared error on test data, in milliseconds.' },
    { label: 'Training fit (train R²)', key: 'train_r2', kind: 'r2', help: 'Coefficient of determination on training data.' },
    { label: 'Cross-check error (CV RMSE)', key: 'cv_rmse', kind: 'ms', help: 'Cross-validation RMSE across folds, in milliseconds.' },
  ];

  return (
    <motion.div
      id="analytics-models"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-surface rounded-2xl border border-contour-strong overflow-hidden flex flex-col scroll-mt-24"
    >
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-topo-5/12 flex items-center justify-center shrink-0">
            <Brain size={17} className="text-topo-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-body text-base font-bold text-ink">AI accuracy</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRefresh?.()}
          disabled={loading}
          className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
          aria-label="Refresh model metrics"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-5 pb-2 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-base border border-contour font-mono text-[10px] text-ink-soft">
              {qp?.artifact_exists ? 'Model available' : 'Model not available'}
        </span>
        {qp?.model_type ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-topo-4/10 border border-topo-4/20 font-mono text-[10px] text-topo-4 font-semibold capitalize">
            AI type: {String(qp.model_type)}
          </span>
        ) : null}
        {qp?.feature_count != null ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-topo-6/10 border border-topo-6/15 font-mono text-[10px] text-topo-6 font-semibold">
            {qp.feature_count} data signals
          </span>
        ) : null}
        {qp?.metrics_source ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-base border border-contour font-mono text-[9px] text-ink-faint">
            Data source: {qp.metrics_source}
          </span>
        ) : null}
        {meetsTarget != null ? (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-mono text-[10px] font-semibold ${
              meetsTarget
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
            title={`Minimum required: ${MIN_TARGET_ACCURACY_PCT}% test accuracy (R²).`}
          >
            Accuracy target: {MIN_TARGET_ACCURACY_PCT}%+
            {' · '}
            {meetsTarget ? 'PASS' : 'BELOW TARGET'}
          </span>
        ) : null}
      </div>

      <div className="px-5 pb-5">
        {loading && !hasMetrics ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-contour border-t-topo-4 animate-spin" />
            <span className="font-body text-xs text-ink-muted">Loading metrics…</span>
          </div>
        ) : null}
        {!loading && !hasMetrics ? (
          <div className="py-8 rounded-xl border border-dashed border-contour bg-base/40 px-4 text-center">
            <Info size={18} className="mx-auto text-ink-faint mb-2 opacity-80" />
            <p className="font-body text-xs text-ink-muted">
              Train the model, then refresh.{' '}
              <code className="font-mono text-[10px] text-topo-4">train_model.py --model predictor</code>
            </p>
          </div>
        ) : null}
        {hasMetrics && m ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map(({ label, key, kind, help }) => {
              const v = m[key];
              const num = typeof v === 'number' ? v : undefined;
              return (
                <div
                  key={String(key)}
                  className="rounded-xl border border-contour-strong bg-base/60 px-4 py-3 text-left"
                >
                  <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint" title={help}>
                    {label}
                  </p>
                  <p className="font-body text-xl font-bold text-ink tabular-nums mt-1">{fmtUnit(num, kind)}</p>
                </div>
              );
            })}
          </div>
        ) : null}

        {data?.anomaly_detector?.artifact_exists ? (
          <p className="font-body text-[10px] text-ink-faint mt-4 border-t border-contour pt-3 leading-snug">
            {data.anomaly_detector.note}
          </p>
        ) : null}

        {data?.workload_clustering?.artifact_exists || data?.cache_predictor?.artifact_exists ? (
          <div className="mt-3 pt-3 border-t border-contour flex flex-wrap gap-1.5">
            {data?.workload_clustering?.artifact_exists ? (
              <span
                className="px-2 py-0.5 rounded-md bg-topo-6/10 border border-topo-6/15 font-mono text-[10px] text-topo-6"
                title="Details in ML insights section below."
              >
                Groups
                {data.workload_clustering?.algorithm ? ` · ${data.workload_clustering.algorithm}` : ''}
              </span>
            ) : null}
            {data?.cache_predictor?.artifact_exists ? (
              <span className="px-2 py-0.5 rounded-md bg-topo-4/10 border border-topo-4/15 font-mono text-[10px] text-topo-4">
                Cache{data.cache_predictor?.is_trained === false ? ' · train' : ''}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
