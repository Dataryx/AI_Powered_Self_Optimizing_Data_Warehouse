/**
 * Active Alerts List Component
 * Displays active alerts with severity and filtering
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Grid, Chip, IconButton, Tabs, Tab, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { Error as ErrorIcon, Warning, Info, ExpandMore, CheckCircle, Close } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { useThemeColors } from '../../theme/useThemeColors';

interface Alert {
  alert_id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  timestamp: string;
  status: string;
  acknowledged: boolean;
  table?: string;
}

interface AlertsData {
  alerts: Alert[];
  total: number;
  by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export const ActiveAlertsList: React.FC = () => {
  const colors = useThemeColors();
  const [alerts, setAlerts] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const data = await apiService.getActiveAlerts();
      setAlerts(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching active alerts:', err);
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await apiService.acknowledgeAlert(alertId);
      setAcknowledgedAlerts((prev) => new Set([...prev, alertId]));
      await fetchAlerts();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <ErrorIcon sx={{ color: colors.error, fontSize: 24 }} />;
      case 'warning':
      case 'medium':
        return <Warning sx={{ color: colors.warning, fontSize: 24 }} />;
      case 'info':
      case 'low':
        return <Info sx={{ color: colors.primary, fontSize: 24 }} />;
      default:
        return <Info sx={{ color: colors.textSecondary, fontSize: 24 }} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { bg: '#ef4444', light: '#ef444420', border: '#ef444440', text: 'white' };
      case 'high':
        return { bg: '#f87171', light: '#f8717120', border: '#f8717140', text: 'white' };
      case 'warning':
        return { bg: '#f59e0b', light: '#f59e0b20', border: '#f59e0b40', text: 'white' };
      case 'medium':
        return { bg: '#fbbf24', light: '#fbbf2420', border: '#fbbf2440', text: 'black' };
      case 'low':
        return { bg: '#3b82f6', light: '#3b82f620', border: '#3b82f640', text: 'white' };
      case 'info':
        return { bg: '#64748b', light: '#64748b20', border: '#64748b40', text: 'white' };
      default:
        return { bg: '#64748b', light: '#64748b20', border: '#64748b40', text: 'white' };
    }
  };

  if (loading || !alerts) {
    return (
      <Card sx={{ background: `linear-gradient(135deg, ${colors.paper} 0%, ${colors.background} 100%)` }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading active alerts...</Typography>
        </CardContent>
      </Card>
    );
  }

  const filteredAlerts = severityFilter === 'all'
    ? alerts.alerts
    : alerts.alerts.filter(a => a.severity === severityFilter);

  const unacknowledgedAlerts = filteredAlerts.filter(a => !a.acknowledged && !acknowledgedAlerts.has(a.alert_id));

  const severityCounts = [
    { label: 'All', value: 'all', count: alerts.total },
    { label: 'Critical', value: 'critical', count: alerts.by_severity.critical },
    { label: 'High', value: 'high', count: alerts.by_severity.high },
    { label: 'Medium', value: 'medium', count: alerts.by_severity.medium },
    { label: 'Low', value: 'low', count: alerts.by_severity.low },
    { label: 'Info', value: 'info', count: alerts.by_severity.info },
  ];

  return (
    <Card
      sx={{
        background: `linear-gradient(135deg, ${colors.paper} 0%, ${colors.background} 100%)`,
        border: '1px solid rgba(239, 68, 68, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: `linear-gradient(135deg, ${colors.error} 0%, ${colors.error}dd 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '1.1rem',
            }}
          >
            Active Alerts
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              label={`${alerts.total} Total`}
              size="small"
              sx={{
                backgroundColor: '#ef444420',
                color: '#ef4444',
                fontWeight: 700,
                fontSize: '0.75rem',
              }}
            />
            <Chip
              label={`${unacknowledgedAlerts.length} Unacknowledged`}
              size="small"
              sx={{
                backgroundColor: `${colors.warning}20`,
                color: colors.warning,
                fontWeight: 700,
                fontSize: '0.75rem',
              }}
            />
          </Box>
        </Box>

        {/* Severity Filter */}
        <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={severityFilter}
            onChange={(_, value) => setSeverityFilter(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minWidth: 80,
                fontSize: '0.75rem',
                fontWeight: 600,
              },
            }}
          >
            {severityCounts.map(({ label, value, count }) => (
              <Tab
                key={value}
                label={`${label} (${count})`}
                value={value}
                sx={{
                  '&.Mui-selected': {
                    color: value === 'critical' || value === 'high' ? colors.error : colors.primary,
                  },
                }}
              />
            ))}
          </Tabs>
        </Box>

        {/* Alerts List */}
        {unacknowledgedAlerts.length === 0 ? (
          <Box
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: 2,
              background: 'linear-gradient(135deg, #10b98110 0%, rgba(255,255,255,0.8) 100%)',
              border: '2px solid #10b98130',
            }}
          >
            <CheckCircle sx={{ color: colors.success, fontSize: 48, mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: colors.success, mb: 1 }}>
              No Active Alerts
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              All systems are operating normally
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {unacknowledgedAlerts.slice(0, 10).map((alert) => {
              const severityColors = getSeverityColor(alert.severity);
              return (
                <Accordion
                  key={alert.alert_id}
                  sx={{
                    background: `linear-gradient(135deg, ${severityColors.light} 0%, rgba(255,255,255,0.9) 100%)`,
                    border: `2px solid ${severityColors.border}`,
                    borderRadius: 2,
                    boxShadow: 'none',
                    '&:before': { display: 'none' },
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 4px 12px ${severityColors.border}`,
                    },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMore sx={{ color: severityColors.bg }} />}
                    sx={{
                      '& .MuiAccordionSummary-content': {
                        alignItems: 'center',
                        gap: 2,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                      {getSeverityIcon(alert.severity)}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                          {alert.title}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.75rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                          }}
                        >
                          {alert.message}
                        </Typography>
                      </Box>
                      <Chip
                        label={alert.severity}
                        size="small"
                        sx={{
                          backgroundColor: severityColors.bg,
                          color: severityColors.text,
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          height: '22px',
                          minWidth: '70px',
                        }}
                      />
                      <Chip
                        label={alert.type}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          color: 'text.secondary',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          height: '22px',
                        }}
                      />
                      {!alert.acknowledged && !acknowledgedAlerts.has(alert.alert_id) && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcknowledge(alert.alert_id);
                          }}
                          sx={{
                            color: '#10b981',
                            '&:hover': {
                              backgroundColor: `${colors.success}20`,
                            },
                          }}
                        >
                          <CheckCircle fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ pl: 6 }}>
                      <Typography variant="body2" sx={{ mb: 1.5, color: 'text.primary' }}>
                        {alert.message}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              Type
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {alert.type}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              Severity
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {alert.severity}
                            </Typography>
                          </Box>
                        </Grid>
                        {alert.table && (
                          <Grid item xs={12} sm={6} md={3}>
                            <Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                Table
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {alert.table}
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                        <Grid item xs={12} sm={6} md={3}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              Occurred At
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {new Date(alert.timestamp).toLocaleString()}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
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

