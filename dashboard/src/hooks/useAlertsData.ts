import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useAlertsData() {
  const [data, setData] = useState<{
    alerts?: any[];
    anomalies?: any[];
    incidents?: any[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alerts, anomalies, incidents] = await Promise.allSettled([
        api.getActiveAlerts(),
        api.getAnomalies(),
        api.getIncidents(),
      ]);
      const alertsList = alerts.status === 'fulfilled' ? ((alerts.value as any)?.alerts ?? []) : [];
      const anomaliesList = anomalies.status === 'fulfilled' ? (Array.isArray(anomalies.value) ? anomalies.value : (anomalies.value as any)?.anomalies ?? []) : [];
      const incidentsList = incidents.status === 'fulfilled' ? (Array.isArray(incidents.value) ? incidents.value : (incidents.value as any)?.incidents ?? []) : [];
      setData({ alerts: alertsList, anomalies: anomaliesList, incidents: incidentsList });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  return { data, loading, error, refetch: fetchAll };
}






