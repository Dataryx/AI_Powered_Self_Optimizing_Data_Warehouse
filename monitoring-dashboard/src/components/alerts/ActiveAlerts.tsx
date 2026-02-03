/**
 * Active Alerts Component
 * Displays active alerts with severity and source information
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip,
  IconButton,
  Divider,
} from '@mui/material';
import { Refresh, Warning, Error as ErrorIcon, Info, CheckCircle } from '@mui/icons-material';
import { apiService } from '../../services/api';

interface Alert {
  alert_id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  timestamp: string;
  status: string;
  acknowledged?: boolean;
  source?: string;
}

interface ActiveAlertsProps {
  refreshKey?: number;
}

export const ActiveAlerts: React.FC<ActiveAlertsProps> = ({ refreshKey = 0 }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await apiService.getActiveAlerts();
      setAlerts(data.alerts || data || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching active alerts:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts, refreshKey]);

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return { bg: '#ef4444', light: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', icon: ErrorIcon };
      case 'medium':
        return { bg: '#f59e0b', light: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', icon: Warning };
      case 'low':
        return { bg: '#3b82f6', light: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', icon: Info };
      default:
        return { bg: '#64748b', light: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.2)', icon: Info };
    }
  };

  const getSourceLabel = (type: string, source?: string) => {
    if (source) return source;
    // Infer source from type
    const typeLower = type?.toLowerCase() || '';
    if (typeLower.includes('etl') || typeLower.includes('pipeline')) return 'ETL';
    if (typeLower.includes('query') || typeLower.includes('performance')) return 'Query Performance';
    if (typeLower.includes('resource') || typeLower.includes('storage')) return 'Resource Usage';
    if (typeLower.includes('freshness') || typeLower.includes('data quality')) return 'Data Freshness';
    return 'System';
  };

  if (loading && alerts.length === 0) {
    return (
      <Card sx={{ boxShadow: 1, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Loading active alerts...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ boxShadow: 1, border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 0.5 }}>
              Active Alerts
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              Alerts are generated from ETL, query, and resource telemetry.
            </Typography>
          </Box>
          <IconButton
            onClick={fetchAlerts}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover',
                transform: 'rotate(180deg)',
              },
              transition: 'all 0.3s',
            }}
          >
            <Refresh fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Alerts List or Empty State */}
        {alerts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircle sx={{ fontSize: 48, color: '#10b981', opacity: 0.3, mb: 1.5 }} />
            <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary', mb: 0.5 }}>
              All Clear — No active alerts
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              System is operating normally
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {alerts.map((alert) => {
              const severityColors = getSeverityColor(alert.severity);
              const SeverityIcon = severityColors.icon;
              const source = getSourceLabel(alert.type, alert.source);

              return (
                <Box
                  key={alert.alert_id}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: `1px solid ${severityColors.border}`,
                    backgroundColor: severityColors.light,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1 }}>
                      <SeverityIcon sx={{ fontSize: 18, color: severityColors.bg, mt: 0.25 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
                          {alert.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                          {alert.message}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label={alert.severity}
                      size="small"
                      sx={{
                        height: '20px',
                        fontSize: '0.7rem',
                        backgroundColor: severityColors.bg,
                        color: 'white',
                        fontWeight: 500,
                        ml: 1,
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                    <Chip
                      label={source}
                      size="small"
                      sx={{
                        height: '20px',
                        fontSize: '0.7rem',
                        backgroundColor: 'action.selected',
                        color: 'text.secondary',
                        fontWeight: 400,
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', ml: 'auto' }}>
                      {new Date(alert.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
