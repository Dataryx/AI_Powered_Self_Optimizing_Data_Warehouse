/**
 * System Health Alerts Component
 * System component health status and alerts.
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert as MuiAlert,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api';

export const SystemHealthAlerts: React.FC = () => {
  const { data: health, isLoading } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: () => apiService.getSystemHealth(),
    refetchInterval: 10000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle color="success" />;
      case 'degraded':
        return <Warning color="warning" />;
      case 'unhealthy':
        return <Error color="error" />;
      default:
        return <Warning color="warning" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'error';
      default:
        return 'warning';
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  const services = health?.services || {};

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">System Health</Typography>
        {health && (
          <Chip
            icon={getStatusIcon(health.overall_status)}
            label={health.overall_status.toUpperCase()}
            color={getStatusColor(health.overall_status) as any}
          />
        )}
      </Box>
      {!health || Object.keys(services).length === 0 ? (
        <MuiAlert severity="info">No health data available</MuiAlert>
      ) : (
        <Grid container spacing={2}>
          {Object.entries(services).map(([serviceName, serviceData]: [string, any]) => (
            <Grid item xs={12} sm={6} md={4} key={serviceName}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle1" fontWeight="medium">
                      {serviceName}
                    </Typography>
                    {getStatusIcon(serviceData.status)}
                  </Box>
                  <Chip
                    label={serviceData.status}
                    color={getStatusColor(serviceData.status) as any}
                    size="small"
                  />
                  {serviceData.details && (
                    <Box sx={{ mt: 2 }}>
                      {Object.entries(serviceData.details).map(([key, value]: [string, any]) => (
                        <Typography key={key} variant="body2" color="text.secondary">
                          {key}: {value}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default SystemHealthAlerts;


