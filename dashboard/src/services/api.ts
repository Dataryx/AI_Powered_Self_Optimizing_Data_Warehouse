/**
 * API client for data warehouse backend (ML Optimization API).
 * Set VITE_API_BASE_URL in .env to match the backend (e.g. http://localhost:8001/api/v1).
 * Default: http://localhost:8000/api/v1 — start the backend on that port or set the env.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export const api = {
  // Warehouse
  getWarehouseSummary: () => request<{ warehouse_summary: any; database?: string }>('/warehouse/summary'),
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
  getSalesStats: () =>
    request<{
      total_sales?: { count?: number; revenue?: number; avg_sale?: number };
      daily_sales?: Array<{ date: string; count?: number; sales?: number; revenue?: number }>;
      top_products?: Array<{ product?: string; product_name?: string; revenue?: number; sales_count?: number }>;
    }>('/warehouse/sales-stats'),
  getCustomerStats: () => request<{ total_customers?: number }>('/warehouse/customer-stats'),
  getTopProducts: (limit = 20) =>
    request<{ products?: Array<{ product?: string; product_name?: string; revenue?: number }> }>(
      `/warehouse/top-products?limit=${limit}`
    ),

  // Health
  getHealth: async () => {
    const base = API_BASE.replace(/\/api\/v1\/?$/, '');
    const res = await fetch(`${base}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  // Monitoring
  getETLJobs: () => request<any>('/monitoring/etl/jobs'),
  getETLJobDefinitions: () => request<any>('/monitoring/etl/job-definitions'),
  runETLJob: (jobName: string) =>
    request<any>('/monitoring/etl/run', {
      method: 'POST',
      body: JSON.stringify({ job_name: jobName }),
    }),
  getPipelineDAG: () => request<any>('/monitoring/etl/pipeline-dag'),
  getDataFreshness: () => request<any>('/monitoring/etl/freshness'),
  getETLErrors: () => request<any>('/monitoring/etl/errors'),
  getThroughputMetrics: () => request<any>('/monitoring/etl/throughput'),
  getDataQualityMetrics: () => request<any>('/monitoring/data-quality'),

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
  getAnomalies: () => request<any>('/alerts/anomalies'),
  getIncidents: () => request<any>('/alerts/incidents'),
  acknowledgeAlert: (alertId: string) => request(`/alerts/acknowledge/${alertId}`, { method: 'POST' }),
  getAlertConfig: () => request<any>('/alerts/config'),
  updateAlertConfig: (config: any) => request('/alerts/config', { method: 'POST', body: JSON.stringify(config) }),

  // Optimization
  getOptimizationRecommendations: (type?: string, status?: string) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    const q = params.toString();
    return request<any>(`/optimization/recommendations${q ? `?${q}` : ''}`);
  },
  applyOptimization: (recommendationId: string, auto = false) =>
    request(`/optimization/recommendations/${recommendationId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ optimization_id: recommendationId, auto }),
    }),
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






