/**
 * Active Alerts Component
 * Displays active alerts with severity and actions
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip,
  IconButton,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Refresh, Warning, Error as ErrorIcon, Info, CheckCircle, ExpandMore, Check } from '@mui/icons-material';
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
}

interface ActiveAlertsProps {
  refreshKey?: number;
}

export const ActiveAlerts: React.FC<ActiveAlertsProps> = ({ refreshKey = 0 }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await apiService.getActiveAlerts();
      setAlerts(data.alerts || data || []);
      setLastUpdate(new Date());
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

  const handleAcknowledge = async (alertId: string) => {
    setAcknowledging(alertId);
    try {
      await apiService.acknowledgeAlert(alertId);
      await fetchAlerts();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    } finally {
      setAcknowledging(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return { bg: '#ef4444', light: '#ef444420', border: '#ef444440', icon: ErrorIcon };
      case 'high':
        return { bg: '#f59e0b', light: '#f59e0b20', border: '#f59e0b40', icon: Warning };
      case 'medium':
        return { bg: '#3b82f6', light: '#3b82f620', border: '#3b82f640', icon: Info };
      case 'low':
      case 'warning':
        return { bg: '#10b981', light: '#10b98120', border: '#10b98140', icon: CheckCircle };
      default:
        return { bg: '#64748b', light: '#64748b20', border: '#64748b40', icon: Info };
    }
  };

  const criticalCount = alerts.filter(a => a.severity?.toLowerCase() === 'critical').length;
  const highCount = alerts.filter(a => a.severity?.toLowerCase() === 'high').length;

  if (loading && alerts.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading active alerts...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        maxHeight: '600px',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #3b82f6 100%)',
        },
      }}
    >
      <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Warning sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                Active Alerts
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                Real-time alert monitoring
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {criticalCount > 0 && (
              <Chip
                label={criticalCount}
                size="small"
                sx={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: '20px',
                }}
              />
            )}
            {highCount > 0 && (
              <Chip
                label={highCount}
                size="small"
                sx={{
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: '20px',
                }}
              />
            )}
            <Chip
              label={alerts.length}
              size="small"
              sx={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
            <IconButton
              onClick={fetchAlerts}
              size="small"
              sx={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                '&:hover': {
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  transform: 'rotate(180deg)',
                },
                transition: 'all 0.3s',
                width: 28,
                height: 28,
              }}
            >
              <Refresh sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box>
              <CheckCircle sx={{ fontSize: 48, color: '#10b981', opacity: 0.5, mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                All Clear!
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                No active alerts
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ flex: 1, overflowY: 'auto', pb: 0.5 }}>
            {alerts.map((alert) => {
              const severityColors = getSeverityColor(alert.severity);
              const SeverityIcon = severityColors.icon;

              return (
                <Accordion
                  key={alert.alert_id}
                  sx={{
                    mb: 1,
                    border: `1px solid ${severityColors.border}`,
                    background: severityColors.light,
                    '&:before': { display: 'none' },
                    boxShadow: 'none',
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMore sx={{ fontSize: 18, color: severityColors.bg }} />}
                    sx={{ minHeight: '48px !important', py: 0.5 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <SeverityIcon sx={{ fontSize: 18, color: severityColors.bg }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {alert.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                          {new Date(alert.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                      <Chip
                        label={alert.severity}
                        size="small"
                        sx={{
                          height: '18px',
                          fontSize: '0.65rem',
                          backgroundColor: severityColors.bg,
                          color: 'white',
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', mb: 1.5, color: 'text.secondary' }}>
                      {alert.message}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip
                        label={alert.type}
                        size="small"
                        sx={{
                          height: '18px',
                          fontSize: '0.65rem',
                          backgroundColor: 'rgba(0, 0, 0, 0.05)',
                          color: 'text.secondary',
                        }}
                      />
                      {!alert.acknowledged && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<Check sx={{ fontSize: 14 }} />}
                          onClick={() => handleAcknowledge(alert.alert_id)}
                          disabled={acknowledging === alert.alert_id}
                          sx={{
                            backgroundColor: severityColors.bg,
                            color: 'white',
                            fontSize: '0.7rem',
                            px: 1.5,
                            py: 0.25,
                            minWidth: 'auto',
                            height: '24px',
                            '&:hover': {
                              backgroundColor: severityColors.bg,
                              opacity: 0.9,
                            },
                          }}
                        >
                          {acknowledging === alert.alert_id ? 'Acknowledging...' : 'Acknowledge'}
                        </Button>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

