/**
 * Maps home-dashboard / bundle alert `type` (from ML API active alerts) to a route + hash
 * so notification clicks open the most relevant screen.
 */
export function hrefForDashboardAlert(alert: Record<string, unknown> | null | undefined): string {
  const t = String(alert?.type ?? '')
    .toLowerCase()
    .trim();
  switch (t) {
    case 'empty_table':
      return '/data-explorer';
    case 'data_quality':
      return '/monitoring#monitoring-data-quality';
    case 'performance':
      return '/optimizations';
    case 'storage':
      return '/analytics#analytics-overview';
    case 'etl_failure':
      return '/monitoring#monitoring-etl';
    case 'model_anomaly':
      return '/alerts#anomalies';
    case 'slow_query':
      return '/analytics#analytics-queries';
    default:
      return '/alerts#inbox';
  }
}
