/** Analytics helpers: only transforms of fields returned by the ML API / Postgres-backed routes. */

export type QueryPerfRow = {
  query_id?: string;
  query_hash?: string;
  avg_execution_time?: number;
  p50_execution_time?: number;
  p95_execution_time?: number;
  p99_execution_time?: number;
  avg_execution_time_ms?: number;
  p50_execution_time_ms?: number;
  p95_execution_time_ms?: number;
  p99_execution_time_ms?: number;
  /** Σ ``calls`` in the time window for this ``query_hash`` (not log-row count). */
  execution_count?: number;
  total_execution_time?: number;
  /** Σ ``total_exec_time_ms`` in the window (API mirrors SQL). */
  total_execution_time_ms?: number;
  cache_hit_rate?: number | null;
  last_executed?: string | null;
  query_text_preview?: string;
  /** Latest ``ml_optimization.query_logs.log_id`` for this fingerprint in the window (DB verification). */
  sample_log_id?: number | null;
};

/** Display rule for “slow” — same as aggregates (documented in UI). */
export const SLOW_AVG_SEC = 1.0;
export const SLOW_P95_SEC = 2.0;

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Σ wall time in ms for this query hash in the window (prefer API ms when non-zero; else seconds). */
export function totalExecutionTimeMs(q: QueryPerfRow): number {
  const msRaw = q.total_execution_time_ms;
  const sec = num(q.total_execution_time);
  if (msRaw != null && Number.isFinite(Number(msRaw))) {
    const ms = Math.max(0, Number(msRaw));
    if (ms > 0) return ms;
    // Payloads sometimes send 0 in *_ms while total_execution_time (seconds) holds Σ wall time.
    if (sec > 0) return sec * 1000;
    return 0;
  }
  return Math.max(0, sec * 1000);
}

/** Mean latency per call in seconds — aligns with Query Performance panel. */
export function avgLatencySeconds(q: QueryPerfRow): number {
  if (q.avg_execution_time_ms != null && Number.isFinite(Number(q.avg_execution_time_ms))) {
    return Number(q.avg_execution_time_ms) / 1000;
  }
  const ec = Math.max(0, Math.floor(num(q.execution_count)));
  const tms = q.total_execution_time_ms;
  if (ec > 0 && tms != null && Number.isFinite(Number(tms))) {
    return Number(tms) / ec / 1000;
  }
  return num(q.avg_execution_time);
}

export function percentileLatencySeconds(q: QueryPerfRow, which: 'p50' | 'p95' | 'p99'): number {
  const ms =
    which === 'p50'
      ? q.p50_execution_time_ms
      : which === 'p95'
        ? q.p95_execution_time_ms
        : q.p99_execution_time_ms;
  if (ms != null && Number.isFinite(Number(ms))) return Number(ms) / 1000;
  const sec =
    which === 'p50'
      ? q.p50_execution_time
      : which === 'p95'
        ? q.p95_execution_time
        : q.p99_execution_time;
  return num(sec);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const pp = Math.max(0, Math.min(1, p));
  const idx = Math.floor(pp * (sorted.length - 1));
  return sorted[idx] ?? 0;
}

/** Per-UTC-hour execution totals (7d window rows: each hash’s count placed at last_seen hour). */
export function deriveWorkloadHourlyExecutions(queries: QueryPerfRow[]): number[] {
  const buckets = Array(24).fill(0);
  for (const q of queries) {
    const le = q.last_executed;
    if (!le) continue;
    const d = new Date(le);
    if (Number.isNaN(d.getTime())) continue;
    buckets[d.getUTCHours()] += num(q.execution_count);
  }
  return buckets;
}

export function derivePeakHourUtc(queries: QueryPerfRow[]): { hour: number; label: string; executions: number } | null {
  const buckets = Array(24).fill(0);
  for (const q of queries) {
    const le = q.last_executed;
    if (!le) continue;
    const d = new Date(le);
    if (Number.isNaN(d.getTime())) continue;
    buckets[d.getUTCHours()] += num(q.execution_count);
  }
  let best = 0;
  let bestH = 0;
  for (let h = 0; h < 24; h++) {
    if (buckets[h] > best) {
      best = buckets[h];
      bestH = h;
    }
  }
  if (best === 0) return null;
  return {
    hour: bestH,
    label: `${String(bestH).padStart(2, '0')}:00 UTC`,
    executions: best,
  };
}

/** Peak UTC hour from DB-backed Σ ``calls`` per hour (``hourlyCallsUtc7d`` bundle field). */
export function derivePeakHourUtcFromDbHourly(hourly: number[]): { hour: number; label: string; executions: number } | null {
  if (!Array.isArray(hourly) || hourly.length !== 24) return null;
  let best = 0;
  let bestH = 0;
  for (let h = 0; h < 24; h++) {
    const v = num(hourly[h], 0);
    if (v > best) {
      best = v;
      bestH = h;
    }
  }
  if (best <= 0) return null;
  return {
    hour: bestH,
    label: `${String(bestH).padStart(2, '0')}:00 UTC`,
    executions: Math.round(best),
  };
}

export type QueryLogRollup = { sample_rows: number; total_calls: number };

export function parseQueryLogRollup(raw: unknown): QueryLogRollup | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const sr = o.sample_rows;
  const tc = o.total_calls;
  const sample_rows = typeof sr === 'number' && Number.isFinite(sr) ? Math.max(0, Math.floor(sr)) : Math.max(0, Math.floor(num(sr, 0)));
  const total_calls = typeof tc === 'number' && Number.isFinite(tc) ? Math.max(0, tc) : Math.max(0, num(tc, 0));
  return { sample_rows, total_calls };
}

/** 24 UTC-hour totals from API; must match DB length for use. */
export function parseHourlyCallsUtc7d(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== 24) return null;
  return raw.map((v) => num(v, 0));
}

/**
 * Maps Monitoring “Metrics aggregation” to UTC-hour bucket width.
 * Sub-hour presets still use hourly buckets (finest signal we have from last_executed).
 */
export function aggregationLabelToBucketHours(label: string): number {
  const t = label.trim().toLowerCase();
  if (t.includes('24 hour')) return 24;
  if (t.includes('6 hour')) return 6;
  return 1;
}

/** Roll 24 hourly counts into wider UTC buckets (e.g. four 6-hour blocks). */
export function rollupHourlyExecutions(
  hourly24: number[],
  bucketHours: number,
): { values: number[]; bucketLabels: string[] } {
  const bh = Math.max(1, Math.min(24, Math.floor(bucketHours)));
  const n = Math.ceil(24 / bh);
  const values = Array.from({ length: n }, (_, i) => {
    let sum = 0;
    for (let h = i * bh; h < Math.min(24, (i + 1) * bh); h++) sum += hourly24[h] ?? 0;
    return sum;
  });
  const bucketLabels = values.map((_, i) => {
    const start = i * bh;
    const end = Math.min(24, (i + 1) * bh) - 1;
    if (bh >= 24) return 'Full day';
    return `${String(start).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:59`;
  });
  return { values, bucketLabels };
}

export function peakFromRolledBuckets(
  values: number[],
  bucketLabels: string[],
  options?: { clock?: 'utc' | 'local' },
): { label: string; executions: number } | null {
  let best = 0;
  let bestI = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > best) {
      best = values[i];
      bestI = i;
    }
  }
  if (best === 0) return null;
  const raw = bucketLabels[bestI] ?? '';
  const kind = options?.clock === 'utc' ? 'UTC' : 'local';
  const label = raw === 'Full day' ? `Full day (${kind})` : `${raw} (${kind})`;
  return { label, executions: best };
}

export function deriveQueryAggregates(queries: QueryPerfRow[]): {
  totalExecutions: number;
  distinctQueries: number;
  slowDistinct: number;
  slowExecutionShare: number;
  weightedAvgLatencySec: number;
  medianAvgLatencySec: number;
} {
  const rows = Array.isArray(queries) ? queries : [];
  let totalExec = 0;
  let weightedSum = 0;
  const avgs: number[] = [];
  const p95s: number[] = [];
  const points = rows.map((q) => {
    const c = Math.max(0, Math.floor(num(q.execution_count)));
    const avg = avgLatencySeconds(q);
    const p95 = percentileLatencySeconds(q, 'p95');
    totalExec += c;
    weightedSum += avg * c;
    avgs.push(avg);
    if (p95 > 0) p95s.push(p95);
    return { c, avg, p95 };
  });

  avgs.sort((a, b) => a - b);
  p95s.sort((a, b) => a - b);
  const medianAvg = avgs.length ? avgs[Math.floor(avgs.length / 2)] : 0;

  // Prefer absolute "slow" thresholds; if they classify nothing on a low-latency
  // workload, fall back to top-quintile thresholds so KPIs reflect real tails.
  const hasAbsoluteSlow = points.some((x) => x.avg >= SLOW_AVG_SEC || x.p95 >= SLOW_P95_SEC);
  const tailAvgThreshold = percentile(avgs.filter((v) => v > 0), 0.8);
  const tailP95Threshold = percentile(p95s.filter((v) => v > 0), 0.8);

  let slowDistinct = 0;
  let slowExec = 0;
  for (const x of points) {
    const isSlow = hasAbsoluteSlow
      ? x.avg >= SLOW_AVG_SEC || x.p95 >= SLOW_P95_SEC
      : (tailAvgThreshold > 0 && x.avg >= tailAvgThreshold) || (tailP95Threshold > 0 && x.p95 >= tailP95Threshold);
    if (!isSlow) continue;
    slowDistinct += 1;
    slowExec += x.c;
  }

  return {
    totalExecutions: totalExec,
    distinctQueries: rows.length,
    slowDistinct,
    slowExecutionShare: totalExec > 0 ? slowExec / totalExec : 0,
    weightedAvgLatencySec: totalExec > 0 ? weightedSum / totalExec : 0,
    medianAvgLatencySec: medianAvg,
  };
}

/** Weighted by execution_count over rows that include cache_hit_rate from the API. */
export function weightedMeanCacheHitRate(queries: QueryPerfRow[]): number | null {
  let wh = 0;
  let w = 0;
  for (const q of queries) {
    const c = num(q.execution_count);
    if (c <= 0) continue;
    const hr = q.cache_hit_rate;
    if (hr == null || !Number.isFinite(hr)) continue;
    wh += hr * c;
    w += c;
  }
  if (w === 0) return null;
  return wh / w;
}

export function topQueriesByTotalTime(queries: QueryPerfRow[], n = 8): QueryPerfRow[] {
  const rows = [...(Array.isArray(queries) ? queries : [])];
  rows.sort((a, b) => totalExecutionTimeMs(b) - totalExecutionTimeMs(a));
  return rows.slice(0, n);
}

export type TopTableRow = { name: string; sizeMb: number; relationOid?: number | null };

export function topTablesFromStorage(utilizationPayload: unknown, limit = 6): TopTableRow[] {
  const u = utilizationPayload as { utilization?: Record<string, unknown> } | null;
  const util = u?.utilization;
  if (!util || typeof util !== 'object') return [];
  const out: TopTableRow[] = [];
  for (const sch of ['gold', 'silver', 'bronze']) {
    const layer = util[sch] as {
      tables?: Array<{ table?: string; size_bytes?: number; relation_oid?: number; relationOid?: number }>;
    } | undefined;
    const tables = layer?.tables;
    if (!Array.isArray(tables)) continue;
    for (const t of tables) {
      const name = `${sch}.${String(t.table ?? '').trim()}`;
      if (!t.table) continue;
      const bytes = num(t.size_bytes);
      const roid = t.relation_oid ?? t.relationOid;
      const relationOid =
        typeof roid === 'number' && Number.isFinite(roid) && roid > 0 ? Math.floor(roid) : null;
      out.push({ name, sizeMb: bytes / (1024 * 1024), relationOid });
    }
  }
  out.sort((a, b) => b.sizeMb - a.sizeMb);
  return out.slice(0, limit);
}

/** Factual lines only (numbers come from API payloads). */
export function deriveAnalyticsFacts(params: {
  queries7d: QueryPerfRow[];
  recCount: number;
  histCount: number;
}): string[] {
  const agg = deriveQueryAggregates(params.queries7d);
  const peak = derivePeakHourUtc(params.queries7d);
  const lines: string[] = [];
  lines.push(`7d logged executions (sum of execution_count on returned hashes): ${agg.totalExecutions.toLocaleString()}.`);
  lines.push(`Distinct query hashes in 7d response: ${agg.distinctQueries}.`);
  lines.push(
    `Patterns with avg ≥ ${SLOW_AVG_SEC}s or p95 ≥ ${SLOW_P95_SEC}s: ${agg.slowDistinct}; their executions are ${(agg.slowExecutionShare * 100).toFixed(1)}% of the 7d total.`,
  );
  if (peak) {
    lines.push(`Peak UTC hour by last_seen × execution_count: ${peak.label} (${peak.executions.toLocaleString()} executions placed in that hour).`);
  }
  lines.push(`Recommendations in API response: ${params.recCount}.`);
  lines.push(`Optimization history rows in API response: ${params.histCount}.`);
  return lines;
}

export type MonthlyApplyPoint = {
  key: string;
  label: string;
  applied: number;
  /** Sum of stored estimated_improvement values (fractions), not currency. */
  sumEstimatedImprovement: number;
};

export function monthlyAppliesFromHistory(history: unknown[], monthsBack = 12): MonthlyApplyPoint[] {
  const rows = Array.isArray(history) ? history : [];
  const now = new Date();
  const points: MonthlyApplyPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    points.push({ key, label, applied: 0, sumEstimatedImprovement: 0 });
  }

  for (const h of rows) {
    const ho = h as { applied_at?: string; created_at?: string };
    const raw = ho.applied_at ?? ho.created_at;
    if (!raw) continue;
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) continue;
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
    const p = points.find((x) => x.key === key);
    if (!p) continue;
    p.applied += 1;
    p.sumEstimatedImprovement += num((h as { estimated_improvement?: number }).estimated_improvement);
  }

  return points;
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    Math.max(0, n),
  );
}

export function parseMonthlyStorageCost(costPayload: unknown): number | null {
  const c = costPayload as { total?: { monthly_cost?: number } } | null;
  const m = c?.total?.monthly_cost;
  return typeof m === 'number' && Number.isFinite(m) ? m : null;
}
