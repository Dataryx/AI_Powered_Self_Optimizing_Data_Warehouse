export interface Metric {
  name: string;
  value: number;
  unit?: string;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface QueryPerformance {
  timestamp: string;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface OptimizationRecommendation {
  id: string;
  type: 'index' | 'partition' | 'cache' | 'query';
  title: string;
  description: string;
  impact: number;
  status: 'pending' | 'applied' | 'rejected';
  priority: 'high' | 'medium' | 'low';
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

