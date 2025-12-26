/**
 * API Types
 * TypeScript type definitions for API requests and responses.
 */

export interface WarehouseStats {
  total_tables: number;
  total_size_gb: number;
  bronze_size_gb: number;
  silver_size_gb: number;
  gold_size_gb: number;
  last_updated: string;
}

export interface TableInfo {
  schema_name: string;
  table_name: string;
  row_count: number;
  size_bytes: number;
  size_gb: number;
  last_analyzed?: string;
}

export interface QueryHistoryItem {
  query_id: string;
  query_text: string;
  execution_time_ms: number;
  rows_returned: number;
  executed_at: string;
  status: string;
}

export interface OptimizationRecommendation {
  recommendation_id: string;
  type: 'index' | 'partition' | 'cache';
  table: string;
  columns: string[];
  estimated_improvement: number;
  cost: number;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'applied' | 'rejected';
  created_at: string;
}

export interface OptimizationHistory {
  optimization_id: string;
  type: string;
  table: string;
  status: string;
  applied_at: string;
  improvement_percent: number;
}

export interface OptimizationMetrics {
  total_recommendations: number;
  applied_count: number;
  pending_count: number;
  rejected_count: number;
  avg_improvement_percent: number;
  total_time_saved_ms: number;
}

export interface RealtimeMetrics {
  timestamp: string;
  cpu_utilization: number;
  memory_utilization: number;
  disk_io_utilization: number;
  active_connections: number;
  query_count: number;
  avg_query_time_ms: number;
  cache_hit_rate: number;
}

export interface HistoricalMetrics {
  timestamp: string;
  metrics: Record<string, number>;
}

export interface Alert {
  alert_id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  created_at: string;
  status: 'active' | 'acknowledged' | 'resolved';
}

export interface SystemHealth {
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, { status: string }>;
  timestamp: string;
}
