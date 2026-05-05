/** Normalize REST/WS payloads that expose rows as `metrics`, `queries`, or a bare array. */
export function normalizeQueryPerformance(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') {
    const o = raw as { queries?: unknown; metrics?: unknown; Queries?: unknown; Metrics?: unknown };
    if (Array.isArray(o.metrics)) return o.metrics;
    if (Array.isArray(o.Metrics)) return o.Metrics;
    if (Array.isArray(o.queries)) return o.queries;
    if (Array.isArray(o.Queries)) return o.Queries;
  }
  return [];
}

/** UTC calendar dates aligned with the optimization WebSocket (`performance_days` in UTC). */
export function utcPerformanceDateRange(performanceDays: number): { startDate: string; endDate: string } {
  const now = new Date();
  const endUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startUtc = new Date(endUtc);
  startUtc.setUTCDate(startUtc.getUTCDate() - performanceDays);
  return {
    startDate: startUtc.toISOString().split('T')[0],
    endDate: endUtc.toISOString().split('T')[0],
  };
}
