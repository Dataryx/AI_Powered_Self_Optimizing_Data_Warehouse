/**
 * API Service
 * Centralized API client for data warehouse endpoints
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

/** HTTP origin (no /api/v1) — same base as REST. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

/** WebSocket origin: VITE_WS_BASE_URL or inferred from VITE_API_BASE_URL (http→ws, https→wss). */
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

/** e.g. path `ws/etl-jobs` → full ws://host/api/v1/ws/etl-jobs */
export function mlApiWebSocketUrl(pathUnderApiV1: string): string {
  const p = pathUnderApiV1.replace(/^\//, '');
  return `${getMlApiWebSocketOrigin()}/api/v1/${p}`;
}

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Warehouse endpoints
  async getWarehouseSummary() {
    return this.request('/warehouse/summary');
  }

  async getSchemas() {
    return this.request('/warehouse/schemas');
  }

  async getTables(schema: string) {
    return this.request(`/warehouse/tables/${schema}`);
  }

  async getTableStats(schema: string, table: string) {
    return this.request(`/warehouse/stats/${schema}/${table}`);
  }

  async getTableData(schema: string, table: string, limit = 100, offset = 0) {
    return this.request(`/warehouse/data/${schema}/${table}?limit=${limit}&offset=${offset}`);
  }

  async getSalesStats() {
    return this.request('/warehouse/sales-stats');
  }

  async getCustomerStats() {
    return this.request('/warehouse/customer-stats');
  }

  async getTopProducts(limit: number = 20) {
    return this.request(`/warehouse/top-products?limit=${limit}`);
  }

  // Health check
  async getHealth() {
    const healthUrl = API_BASE_URL.replace('/api/v1', '') + '/health';
    const response = await fetch(healthUrl);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // Monitoring endpoints
  async getETLJobs() {
    return this.request('/monitoring/etl/jobs');
  }

  async getETLJobDefinitions() {
    return this.request('/monitoring/etl/job-definitions');
  }

  async runETLJob(jobName: string) {
    return this.request('/monitoring/etl/run', {
      method: 'POST',
      body: JSON.stringify({ job_name: jobName }),
    });
  }

  async getPipelineDAG() {
    return this.request('/monitoring/etl/pipeline-dag');
  }

  async getDataFreshness() {
    return this.request('/monitoring/etl/freshness');
  }

  async getETLErrors() {
    return this.request('/monitoring/etl/errors');
  }

  async getThroughputMetrics() {
    return this.request('/monitoring/etl/throughput');
  }

  async getDataQualityMetrics() {
    return this.request('/monitoring/data-quality');
  }

  // Storage endpoints
  async getStorageUtilization() {
    return this.request('/storage/utilization');
  }

  async getGrowthTrends(days: number = 30) {
    return this.request(`/storage/growth-trends?days=${days}`);
  }

  async getCompressionStats() {
    return this.request('/storage/compression');
  }

  async getCachePerformance() {
    return this.request('/storage/cache');
  }

  async getResourceAllocation() {
    return this.request('/storage/resources');
  }

  async getCostTracking() {
    return this.request('/storage/cost');
  }

  // Alert endpoints
  async getActiveAlerts() {
    return this.request('/alerts/active');
  }

  async getAlertHistory(days: number = 30) {
    return this.request(`/alerts/history?days=${days}`);
  }

  async getAnomalies() {
    return this.request('/alerts/anomalies');
  }

  async getIncidents() {
    return this.request('/alerts/incidents');
  }

  async acknowledgeAlert(alertId: string) {
    return this.request(`/alerts/acknowledge/${alertId}`, { method: 'POST' });
  }

  async getAlertConfig() {
    return this.request('/alerts/config');
  }

  async updateAlertConfig(config: any) {
    return this.request('/alerts/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // Optimization endpoints
  async getOptimizationRecommendations(
    type?: string,
    status?: string,
    limit: number = 100
  ) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    params.append('limit', String(limit));
    const query = params.toString();
    return this.request(`/optimization/recommendations${query ? `?${query}` : ''}`);
  }

  async applyOptimization(
    recommendationId: string,
    auto: boolean = false,
    snapshot?: Record<string, unknown>,
  ) {
    return this.request(`/optimization/recommendations/${encodeURIComponent(recommendationId)}/apply`, {
      method: 'POST',
      body: JSON.stringify({
        optimization_id: recommendationId,
        auto,
        ...(snapshot && Object.keys(snapshot).length > 0 ? { snapshot } : {}),
      }),
    });
  }

  async getQueryPerformance(startDate?: string, endDate?: string, queryId?: string, limit: number = 100) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (queryId) params.append('query_id', queryId);
    params.append('limit', limit.toString());
    return this.request(`/optimization/query-performance?${params.toString()}`);
  }

  async getOptimizationHistory(limit: number = 100) {
    return this.request(`/optimization/history?limit=${limit}`);
  }
}

export const apiService = new ApiService();



