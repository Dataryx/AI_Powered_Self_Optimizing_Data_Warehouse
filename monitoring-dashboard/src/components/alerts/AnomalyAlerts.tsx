/**
 * Anomaly Alerts Component
 * Real-time anomaly detection alerts.
 */

import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Card,
  CardContent,
  CircularProgress,
  Alert as MuiAlert,
  Button,
} from '@mui/material';
import {
  Warning,
  Error,
  Info,
  CheckCircle,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatRelativeTime } from '../../utils/formatters';
import { Alert } from '../../types/api.types';

export const AnomalyAlerts: React.FC = () => {
  const { data: alerts, isLoading, refetch } = useQuery<Alert[]>({
    queryKey: ['anomalyAlerts'],
    queryFn: () => apiService.getActiveAlerts(),
    refetchInterval: 10000,
  });

  const { messages } = useWebSocket({ channels: ['alerts'], autoConnect: true });

  useEffect(() => {
    // Process WebSocket alerts
    const latestMessage = messages[messages.length - 1];
    if (latestMessage?.channel === 'alerts') {
      refetch();
    }
  }, [messages, refetch]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Error color="error" />;
      case 'high':
        return <Error color="error" />;
      case 'medium':
        return <Warning color="warning" />;
      default:
        return <Info color="info" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Anomaly Alerts</Typography>
        <Button size="small" onClick={() => refetch()}>
          Refresh
        </Button>
      </Box>
      {!alerts || alerts.length === 0 ? (
        <MuiAlert severity="success">No active anomaly alerts</MuiAlert>
      ) : (
        <List>
          {alerts.map((alert) => (
            <Card key={alert.alert_id} sx={{ mb: 2 }}>
              <CardContent>
                <Box display="flex" alignItems="start" gap={2}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getSeverityIcon(alert.severity)}
                  </ListItemIcon>
                  <Box sx={{ flexGrow: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {alert.message}
                      </Typography>
                      <Chip
                        label={alert.severity}
                        color={getSeverityColor(alert.severity) as any}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {formatRelativeTime(alert.created_at)}
                    </Typography>
                    {alert.details && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Details: {JSON.stringify(alert.details)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </List>
      )}
    </Box>
  );
};

export default AnomalyAlerts;


