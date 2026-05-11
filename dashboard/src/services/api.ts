/**
 * API client for data warehouse backend (ML Optimization API).
 * Set VITE_API_BASE_URL in .env to match the backend (e.g. http://localhost:8001/api/v1).
 * Default: http://localhost:8000/api/v1 — start the backend on that port or set the env.
 * Optimizations live stream: optional VITE_WS_BASE_URL if WS host differs from VITE_API_BASE_URL (rare).
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

/** Origin used for /health (no /api/v1 prefix). */
export const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

/**
 * WebSocket origin (scheme + host[:port]) for the ML API.
 * Matches REST by default: derived from VITE_API_BASE_URL (http→ws, https→wss).
 * Set VITE_WS_BASE_URL only when the socket endpoint is on a different origin than REST.
 */
export function getMlApiWebSocketOrigin(): string {
  const override =
    typeof import.meta.env.VITE_WS_BASE_URL === 'string' ? import.meta.env.VITE_WS_BASE_URL.trim() : '';
  if (override) {
    return override.replace(/\/+$/, '');
  }
  const http = API_ORIGIN.replace(/\/+$/, '');
  if (http.startsWith('https://')) {
    return `wss://${http.slice('https://'.length)}`;
  }
  if (http.startsWith('http://')) {
    return `ws://${http.slice('http://'.length)}`;
  }
  return http;
}

/** Full URL for GET /api/v1/ws/optimization-stream (query string with or without leading `?`). */
export function buildOptimizationStreamWebSocketUrl(query: string): string {
  const q = query.startsWith('?') ? query : `?${query}`;
  return `${getMlApiWebSocketOrigin()}/api/v1/ws/optimization-stream${q}`;
}

function isLikelyNetworkFailure(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /failed to fetch|networkerror|load failed|connection refused|err_connection/i.test(msg);
}

/** User-facing hint when the browser cannot reach the backend (e.g. nothing on :8000). */
export function formatApiUnreachableMessage(urlForLog?: string): string {
  const hint =
    `Cannot reach the API at ${API_ORIGIN}. ` +
    `Start the ML Optimization API from the repo root: python start_services.py (default http://localhost:8000). ` +
    `If it runs elsewhere, set VITE_API_BASE_URL in dashboard/.env (e.g. http://localhost:8001/api/v1).`;
  return urlForLog ? `${hint} Request: ${urlForLog}` : hint;
}

/** Non-2xx API response with HTTP status and FastAPI-style `detail` (string or serialized validation errors). */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`API ${status}: ${detail}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

function parseFastApiDetail(detail: unknown): string {
  if (detail == null) return 'Request failed';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((x) => {
        if (x && typeof x === 'object' && 'msg' in x) {
          return String((x as { msg?: unknown }).msg ?? JSON.stringify(x));
        }
        return typeof x === 'object' ? JSON.stringify(x) : String(x);
      })
      .join('; ');
  }
  return String(detail);
}

/** Short label + server message for Implement (optimization apply) failures. */
export function formatOptimizationApplyError(e: unknown): string {
  if (e instanceof ApiError) {
    const { status, detail } = e;
    const headline =
      status === 403
        ? 'Permission denied'
        : status === 409
          ? 'Already satisfied'
          : status === 422
            ? 'Apply blocked (policy)'
            : status === 400
              ? 'Invalid request'
              : status === 500
                ? 'Server error'
                : `Request failed (${status})`;
    return `${headline} — ${detail}`;
  }
  if (e instanceof Error) return e.message;
  return 'Could not reach optimization API.';
}

/** Successful apply payload from ML API. */
export type OptimizationApplyApplied = {
  outcome: 'applied';
  recommendation_id?: string;
  status?: string;
  applied_at?: string;
  persisted?: boolean;
  ddl_executed?: string;
  created_index_name?: string;
};

/** 409 = index already exists; expected for Implement when DB is already optimized. */
export type OptimizationApplyAlreadySatisfied = { outcome: 'already_satisfied'; detail: string };

export type ApplyOptimizationResult = OptimizationApplyApplied | OptimizationApplyAlreadySatisfied;

/**
 * POST apply — does not throw on 409 (returns `already_satisfied`) so callers avoid treating
 * redundant index as an exception; reduces noisy stack traces in devtools.
 */
async function optimizationApplyRequest(
  recommendationId: string,
  auto = false,
  snapshot?: Record<string, unknown>,
): Promise<ApplyOptimizationResult> {
  const endpoint = `/optimization/recommendations/${encodeURIComponent(recommendationId)}/apply`;
  const url = `${API_BASE}${endpoint}`;
  const body = JSON.stringify({
    optimization_id: recommendationId,
    auto,
    ...(snapshot && Object.keys(snapshot).length > 0 ? { snapshot } : {}),
  });
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw new Error(formatApiUnreachableMessage(url));
    }
    throw e instanceof Error ? e : new Error(String(e));
  }

  if (res.status === 409) {
    let detail = res.statusText || 'Already satisfied';
    const ct = res.headers.get('content-type') ?? '';
    try {
      const text = await res.text();
      if (ct.includes('application/json') && text) {
        const j = JSON.parse(text) as { detail?: unknown };
        if (j?.detail != null) {
          detail = parseFastApiDetail(j.detail);
        } else {
          detail = text.slice(0, 800);
        }
      } else if (text) {
        detail = text.slice(0, 800);
      }
    } catch {
      /* keep detail */
    }
    return { outcome: 'already_satisfied', detail };
  }

  if (!res.ok) {
    let detail = res.statusText || 'Request failed';
    const ct = res.headers.get('content-type') ?? '';
    try {
      const text = await res.text();
      if (ct.includes('application/json') && text) {
        const j = JSON.parse(text) as { detail?: unknown };
        if (j?.detail != null) {
          detail = parseFastApiDetail(j.detail);
        } else {
          detail = text.slice(0, 800);
        }
      } else if (text) {
        detail = text.slice(0, 800);
      }
    } catch {
      /* keep detail */
    }
    throw new ApiError(res.status, detail);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const outcome = String(data.outcome ?? data.status ?? '').toLowerCase();
  if (outcome === 'already_satisfied') {
    const detail =
      typeof data.detail === 'string' && data.detail.trim()
        ? data.detail
        : 'No new index was required; a valid leading index already exists.';
    return { outcome: 'already_satisfied', detail };
  }
  return {
    outcome: 'applied',
    recommendation_id: data.recommendation_id as string | undefined,
    status: data.status as string | undefined,
    applied_at: data.applied_at as string | undefined,
    persisted: data.persisted as boolean | undefined,
    ddl_executed: data.ddl_executed as string | undefined,
    created_index_name: data.created_index_name as string | undefined,
  };
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      cache: options?.cache ?? 'no-store',
      headers: { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) },
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw new Error(formatApiUnreachableMessage(url));
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    let detail = res.statusText || 'Request failed';
    const ct = res.headers.get('content-type') ?? '';
    try {
      const text = await res.text();
      if (ct.includes('application/json') && text) {
        const j = JSON.parse(text) as { detail?: unknown };
        if (j?.detail != null) {
          detail = parseFastApiDetail(j.detail);
        } else {
          detail = text.slice(0, 800);
        }
      } else if (text) {
        detail = text.slice(0, 800);
      }
    } catch {
      /* keep detail */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

export const api = {
  logSystemEvent: async (payload: {
    event_type: 'page_load' | 'route_change' | 'click' | 'api_activity' | 'system';
    page?: string;
    message?: string;
    details?: Record<string, unknown>;
    source?: string;
  }) => {
    try {
      await request<{ ok: boolean; logged_at: string; event_id?: string; summary?: string }>('/system-logs/events', {
        method: 'POST',
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      // Do not block UI when telemetry logging fails.
    }
  },
  /** Recent parsed system activity log events (newest first). */
  getSystemActivityEvents: (limit = 50) =>
    request<{
      events: Array<Record<string, unknown>>;
      returned: number;
      limit: number;
      parse_errors_in_tail: number;
      log_path: string | null;
    }>(`/system-logs/events?limit=${encodeURIComponent(String(limit))}`),

  // Warehouse
  getWarehouseSummary: () => request<{ warehouse_summary: any; database?: string }>('/warehouse/summary'),
  /** One request for the home dashboard (summary + sales + customers + alerts + health). */
  getHomeDashboard: () =>
    request<{
      summary?: { warehouse_summary?: unknown; database?: string } | null;
      sales?: unknown;
      customers?: unknown;
      alerts?: { alerts?: unknown[] } | null;
      health?: Record<string, unknown> | null;
    }>('/warehouse/home-dashboard'),
  getSchemas: () => request<string[] | { schemas?: string[] }>('/warehouse/schemas'),
  getTables: (schema: string) => request<{ tables?: string[] } | string[]>(`/warehouse/tables/${schema}`),
  getTableStats: (schema: string, table: string) =>
    request<{
      schema?: string;
      table?: string;
      row_count?: number;
      columns?: number;
      updated?: string;
      size?: string;
      size_bytes?: number;
      n_live_tup?: number | null;
      last_vacuum?: string | null;
      last_autovacuum?: string | null;
      last_analyze?: string | null;
      last_autoanalyze?: string | null;
    }>(`/warehouse/stats/${schema}/${table}`),
  getTableData: (schema: string, table: string, limit = 100, offset = 0) =>
    request(`/warehouse/data/${schema}/${table}?limit=${limit}&offset=${offset}`),
  /** `days`: rolling window for `daily_sales` (default 60). Use `0` for all dates in fact_sales. */
  getSalesStats: (opts?: { days?: number }) => {
    const d = opts?.days;
    const q = d === undefined ? '' : `?days=${encodeURIComponent(String(d))}`;
    return request<{
      total_sales?: { count?: number; revenue?: number; avg_sale?: number };
      daily_sales?: Array<{ date: string; count?: number; sales?: number; revenue?: number }>;
      daily_sales_lookback_days?: number;
      top_products?: Array<{ product?: string; product_name?: string; revenue?: number; sales_count?: number }>;
    }>(`/warehouse/sales-stats${q}`, { cache: 'no-store' });
  },
  getCustomerStats: () => request<{ total_customers?: number }>('/warehouse/customer-stats'),
  getTopProducts: (limit = 20) =>
    request<{ products?: Array<{ product?: string; product_name?: string; revenue?: number }> }>(
      `/warehouse/top-products?limit=${limit}`
    ),

  // Health (lite=true: SELECT 1 only — faster than full pg_tables scan)
  getHealth: async (lite = true) => {
    const healthUrl = `${API_ORIGIN}/health${lite ? '?lite=true' : ''}`;
    let res: Response;
    try {
      res = await fetch(healthUrl);
    } catch (e) {
      if (isLikelyNetworkFailure(e)) {
        throw new Error(formatApiUnreachableMessage(healthUrl));
      }
      throw e instanceof Error ? e : new Error(String(e));
    }
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  // Monitoring
  /** Full ETL Monitoring page in one response (preferred). */
  getETLMonitoringPage: (refresh = false) =>
    request<{
      jobs?: unknown[];
      jobDefinitions?: unknown[];
      pipeline?: unknown;
      errors?: unknown[];
      throughput?: unknown;
      freshness?: unknown;
      dataQuality?: unknown;
    }>(`/monitoring/etl/monitoring-page${refresh ? '?refresh=true' : ''}`),
  /** Bundled jobs + definitions + pipeline + errors + throughput (parallel DB on server). Pair with freshness + data-quality calls. */
  getETLMonitoringDashboardBundle: (refresh = false) =>
    request<{
      jobs?: unknown[];
      jobDefinitions?: unknown[];
      pipeline?: unknown;
      errors?: unknown[];
      throughput?: unknown;
    }>(`/monitoring/etl/dashboard-bundle${refresh ? '?refresh=true' : ''}`),
  getETLJobs: () => request<any>('/monitoring/etl/jobs'),
  getETLJobDefinitions: () => request<any>('/monitoring/etl/job-definitions'),
  runETLJob: (jobName: string) =>
    request<any>('/monitoring/etl/run', {
      method: 'POST',
      body: JSON.stringify({ job_name: jobName }),
    }),
  getPipelineDAG: () => request<any>('/monitoring/etl/pipeline-dag'),
  getDataFreshness: (refresh = false) =>
    request<any>(`/monitoring/etl/freshness${refresh ? '?refresh=true' : ''}`),
  getETLErrors: () => request<any>('/monitoring/etl/errors'),
  getThroughputMetrics: () => request<any>('/monitoring/etl/throughput'),
  getDataQualityMetrics: (refresh = false) =>
    request<any>(`/monitoring/data-quality${refresh ? '?refresh=true' : ''}`),

  // Storage
  getStorageUtilization: () => request<any>('/storage/utilization'),
  getGrowthTrends: (days = 30) => request<any>(`/storage/growth-trends?days=${days}`),
  getCompressionStats: () => request<any>('/storage/compression'),
  getCachePerformance: () => request<any>('/storage/cache'),
  getResourceAllocation: () => request<any>('/storage/resources'),
  getCostTracking: () => request<any>('/storage/cost'),

  // Alerts
  getActiveAlerts: () =>
    request<{ alerts?: Array<{ alert_id?: string; type?: string; severity?: string; title?: string; message?: string; timestamp?: string }> }>('/alerts/active'),
  getAlertHistory: (days = 30) => request<any>(`/alerts/history?days=${days}`),
  /** One request for Alerts page (active + anomalies + incidents). */
  getAlertsPageBundle: () =>
    request<{ active?: unknown; anomalies?: unknown; incidents?: unknown }>('/alerts/page-bundle'),
  getAnomalies: () => request<any>('/alerts/anomalies'),
  getIncidents: () => request<any>('/alerts/incidents'),
  acknowledgeAlert: (alertId: string) => request(`/alerts/acknowledge/${alertId}`, { method: 'POST' }),
  acknowledgeAlertsBatch: (alertIds: string[]) =>
    request<{ acknowledged?: unknown[]; count?: number }>(`/alerts/acknowledge-batch`, {
      method: 'POST',
      body: JSON.stringify({ alert_ids: alertIds }),
    }),
  getAlertConfig: () =>
    request<{
      configs: Array<{
        alert_type: string;
        enabled: boolean;
        severity: string;
        threshold: number;
        description?: string;
      }>;
    }>('/alerts/config'),
  /** Batch update (preferred). Also accepts legacy single-object bodies via the same route. */
  updateAlertConfigs: (
    configs: Array<{ alert_type: string; threshold: number; enabled: boolean; severity: string }>,
  ) =>
    request<{
      message?: string;
      configs: Array<{
        alert_type: string;
        enabled: boolean;
        severity: string;
        threshold: number;
        description?: string;
      }>;
    }>('/alerts/config', { method: 'POST', body: JSON.stringify({ configs }) }),
  updateAlertConfig: (config: unknown) =>
    request('/alerts/config', { method: 'POST', body: JSON.stringify(config) }),

  // Optimization
  /** One request for Analytics page (query-performance + history + recommendations). */
  /** Query-time predictor train/test R², MAE, RMSE (when saved in artifact or sidecar JSON). */
  getMlModelMetrics: () =>
    request<{
      query_time_predictor?: {
        artifact_exists?: boolean;
        model_type?: string | null;
        feature_count?: number | null;
        metrics?: Record<string, number> | null;
        metrics_source?: string | null;
      };
      anomaly_detector?: { artifact_exists?: boolean; note?: string };
      workload_clustering?: {
        artifact_exists?: boolean;
        algorithm?: string | null;
        n_clusters?: number | null;
      };
      cache_predictor?: {
        artifact_exists?: boolean;
        is_trained?: boolean;
        training_stats?: Record<string, number | string>;
      };
    }>('/optimization/ml-model-metrics'),

  getWorkloadClusters: (limit = 2000) =>
    request<{
      model_loaded?: boolean;
      message?: string;
      total_queries?: number;
      cluster_counts?: Record<string, number>;
      profiles?: Record<string, Record<string, number>>;
      query_samples?: Record<
        string,
        Array<{
          query_preview?: string;
          calls_sum?: number;
          mean_exec_ms?: number;
          sample_count?: number;
        }>
      >;
      algorithm?: string | null;
      metadata?: {
        sample_limit?: number;
        data_watermark_utc?: string | null;
        degraded_mode?: boolean;
        degraded_reason?: string;
        contract_version?: string;
      };
    }>(`/optimization/workload-clusters?limit=${limit}`),
  getWorkloadClusterQueries: (opts: {
    clusterId: number;
    page?: number;
    pageSize?: number;
    sampleLimit?: number;
  }) => {
    const p = new URLSearchParams();
    p.append('page', String(opts.page ?? 1));
    p.append('page_size', String(opts.pageSize ?? 10));
    p.append('sample_limit', String(opts.sampleLimit ?? 5000));
    return request<{
      model_loaded?: boolean;
      cluster_id?: number;
      page?: number;
      page_size?: number;
      total?: number;
      total_pages?: number;
      queries?: Array<{
        log_id?: number | null;
        query_hash?: string | null;
        query_preview?: string;
        calls_sum?: number;
        mean_exec_ms?: number;
        sample_count?: number;
        collected_at?: string | null;
      }>;
      message?: string;
      metadata?: {
        sample_limit?: number;
        data_watermark_utc?: string | null;
        degraded_mode?: boolean;
        degraded_reason?: string;
        contract_version?: string;
      };
    }>(`/optimization/workload-clusters/${encodeURIComponent(String(opts.clusterId))}/queries?${p.toString()}`);
  },

  getCacheCandidates: (opts?: { logsLimit?: number; limit?: number; threshold?: number }) => {
    const p = new URLSearchParams();
    if (opts?.logsLimit != null) p.append('logs_limit', String(opts.logsLimit));
    if (opts?.limit != null) p.append('limit', String(opts.limit));
    if (opts?.threshold != null) p.append('threshold', String(opts.threshold));
    const q = p.toString();
    return request<{
      candidates?: Array<{
        query_preview?: string;
        cache_probability?: number;
        sample_count?: number;
        calls_sum?: number;
        mean_exec_ms?: number;
        source?: string;
        sample_log_id?: number | null;
      }>;
      total_query_rows?: number;
      model_trained?: boolean;
      message?: string;
      metadata?: {
        logs_limit?: number;
        data_watermark_utc?: string | null;
        degraded_mode?: boolean;
        degraded_reason?: string;
        contract_version?: string;
      };
    }>(`/optimization/cache-candidates${q ? `?${q}` : ''}`);
  },
  getCacheCandidatesPaged: (opts?: { page?: number; pageSize?: number; logsLimit?: number; threshold?: number }) => {
    const p = new URLSearchParams();
    p.append('page', String(opts?.page ?? 1));
    p.append('page_size', String(opts?.pageSize ?? 10));
    p.append('logs_limit', String(opts?.logsLimit ?? 8000));
    p.append('threshold', String(opts?.threshold ?? 0.45));
    return request<{
      candidates?: Array<{
        query_preview?: string;
        cache_probability?: number;
        sample_count?: number;
        calls_sum?: number;
        mean_exec_ms?: number;
        source?: string;
        sample_log_id?: number | null;
      }>;
      total_query_rows?: number;
      total?: number;
      page?: number;
      page_size?: number;
      total_pages?: number;
      model_trained?: boolean;
      message?: string;
      metadata?: {
        logs_limit?: number;
        data_watermark_utc?: string | null;
        degraded_mode?: boolean;
        degraded_reason?: string;
        contract_version?: string;
      };
    }>(`/optimization/cache-candidates/paged?${p.toString()}`);
  },

  getAnalyticsPageBundle: () =>
    request<{
      queryPerformance?: unknown;
      optimizationHistory?: unknown;
      recommendations?: unknown;
    }>('/optimization/analytics-page-bundle'),
  /**
   * Full Analytics data slice: 1d/7d/30d query performance + history + recommendations (single DB connection on server).
   */
  getAnalyticsDashboardBundle: (opts?: {
    performanceLimit?: number;
    historyLimit?: number;
    recommendationsLimit?: number;
    /** Third query-performance window length in days (dashboard “Data retention” setting). */
    performanceDaysLong?: number;
  }) => {
    const p = new URLSearchParams();
    if (opts?.performanceLimit != null) p.append('performance_limit', String(opts.performanceLimit));
    if (opts?.historyLimit != null) p.append('history_limit', String(opts.historyLimit));
    if (opts?.recommendationsLimit != null) p.append('recommendations_limit', String(opts.recommendationsLimit));
    if (opts?.performanceDaysLong != null) p.append('performance_days_long', String(opts.performanceDaysLong));
    const q = p.toString();
    return request<{
      queryPerformance1d?: unknown;
      queryPerformance7d?: unknown;
      queryPerformance30d?: unknown;
      optimizationHistory?: unknown;
      recommendations?: unknown;
      metadata?: {
        window_start_utc?: string | null;
        window_end_utc?: string | null;
        data_watermark_utc?: string | null;
        degraded_mode?: boolean;
        degraded_reason?: string;
        contract_version?: string;
      };
    }>(`/optimization/analytics-dashboard-bundle${q ? `?${q}` : ''}`);
  },
  getOptimizationRecommendations: (type?: string, status?: string, limit = 100) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    params.append('limit', String(limit));
    return request<any>(`/optimization/recommendations?${params.toString()}`);
  },
  applyOptimization: optimizationApplyRequest,
  getQueryPerformance: (params?: { start_date?: string; end_date?: string; query_id?: string; limit?: number }) => {
    const p = new URLSearchParams();
    if (params?.start_date) p.append('start_date', params.start_date);
    if (params?.end_date) p.append('end_date', params.end_date);
    if (params?.query_id) p.append('query_id', params.query_id);
    p.append('limit', String(params?.limit ?? 100));
    return request<any>(`/optimization/query-performance?${p.toString()}`);
  },
  getOptimizationHistory: (limit = 100) => request<any>(`/optimization/history?limit=${limit}`),
};






