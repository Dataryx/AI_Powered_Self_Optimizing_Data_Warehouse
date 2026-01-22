/**
 * Error and Retry Tracker Component
 * Displays ETL errors and retry tracking with modern design
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, Typography, Box, Chip, Accordion, AccordionSummary, AccordionDetails, IconButton, LinearProgress } from '@mui/material';
import { Error as ErrorIcon, Warning, Info, ExpandMore, Refresh, CheckCircle, AccessTime } from '@mui/icons-material';
import { apiService } from '../../services/api';

interface ETLError {
  error_id: string;
  type: string;
  severity: string;
  table?: string;
  message: string;
  occurred_at: string;
  retry_count: number;
  status: string;
  job_name?: string;
  progress?: number;
}

interface ErrorRetryTrackerProps {
  refreshKey?: number;
}

export const ErrorRetryTracker: React.FC<ErrorRetryTrackerProps> = ({ refreshKey = 0 }) => {
  const [errors, setErrors] = useState<ETLError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchErrors = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getETLErrors();
      console.log('Fetched ETL errors:', data);
      setErrors(data.errors || []);
      setLastFetch(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching ETL errors:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ETL errors';
      setError(errorMessage);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
    const interval = setInterval(fetchErrors, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [refreshKey, fetchErrors]);

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <ErrorIcon sx={{ color: '#ef4444', fontSize: 20 }} />;
      case 'warning':
      case 'medium':
        return <Warning sx={{ color: '#f59e0b', fontSize: 20 }} />;
      default:
        return <Info sx={{ color: '#64748b', fontSize: 20 }} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { bg: '#ef4444', text: 'white', border: '#ef4444' };
      case 'high':
        return { bg: '#f87171', text: 'white', border: '#f87171' };
      case 'warning':
        return { bg: '#f59e0b', text: 'white', border: '#f59e0b' };
      case 'medium':
        return { bg: '#fbbf24', text: 'black', border: '#fbbf24' };
      default:
        return { bg: '#64748b', text: 'white', border: '#64748b' };
    }
  };

  if (loading && errors.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <LinearProgress sx={{ width: '100%', height: 4, borderRadius: 3 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 'fit-content' }}>
              Loading error tracking...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error && errors.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <ErrorIcon sx={{ color: '#ef4444', fontSize: 48, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ef4444', mb: 1 }}>
            Error Loading Error Tracker
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {error}
          </Typography>
          <IconButton onClick={fetchErrors} sx={{ color: '#ef4444' }}>
            <Refresh /> Retry
          </IconButton>
        </CardContent>
      </Card>
    );
  }

  const activeErrors = errors.filter(e => e.status === 'active');
  const errorCounts = {
    total: errors.length,
    active: activeErrors.length,
    bySeverity: {
      critical: errors.filter(e => e.severity === 'critical').length,
      warning: errors.filter(e => e.severity === 'warning').length,
      info: errors.filter(e => e.severity === 'info').length,
    },
  };

  return (
    <Card
      sx={{
        height: '100%',
        width: 500,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(239, 68, 68, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: '0.95rem',
                whiteSpace: 'nowrap',
              }}
            >
              Error & Retry Tracker
            </Typography>
            {errorCounts.total > 0 && (
              <Chip
                label={`${errorCounts.total}`}
                size="small"
                sx={{
                  backgroundColor: '#ef444420',
                  color: '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.65rem',
                  height: '18px',
                  whiteSpace: 'nowrap',
                }}
              />
            )}
            {lastFetch && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary', 
                  fontSize: '0.65rem',
                  whiteSpace: 'nowrap',
                  ml: 'auto',
                  display: { xs: 'none', sm: 'block' },
                }}
              >
                {formatTimeAgo(lastFetch.toISOString())}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
            {errorCounts.active > 0 && (
              <Chip
                icon={<ErrorIcon sx={{ fontSize: 12 }} />}
                label={errorCounts.active}
                size="small"
                sx={{
                  backgroundColor: '#ef444420',
                  color: '#ef4444',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  height: '20px',
                  whiteSpace: 'nowrap',
                }}
              />
            )}
            <IconButton 
              size="small" 
              onClick={fetchErrors} 
              sx={{ 
                color: '#ef4444',
                padding: '4px',
                '&:hover': {
                  backgroundColor: '#ef444410',
                },
              }}
            >
              <Refresh sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {activeErrors.length === 0 ? (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3,
                textAlign: 'center',
                borderRadius: 2,
                background: 'linear-gradient(135deg, #10b98110 0%, rgba(255,255,255,0.95) 100%)',
                border: '2px solid #10b98130',
                position: 'relative',
                overflow: 'hidden',
                minHeight: 200,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
                },
              }}
            >
              <CheckCircle sx={{ color: '#10b981', fontSize: 48, mb: 1.5 }} />
              <Typography variant="body1" sx={{ fontWeight: 700, color: '#10b981', mb: 0.5, fontSize: '0.95rem' }}>
                No Active Errors
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                All ETL processes are running smoothly
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', maxHeight: 400 }}>
              {activeErrors.slice(0, 6).map((error) => {
              const severityColors = getSeverityColor(error.severity);
              return (
                <Accordion
                  key={error.error_id}
                  sx={{
                    background: `linear-gradient(135deg, ${severityColors.bg}10 0%, rgba(255,255,255,0.95) 100%)`,
                    border: `1.5px solid ${severityColors.border}40`,
                    borderRadius: 2,
                    boxShadow: 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:before': { display: 'none' },
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: `0 4px 12px ${severityColors.border}30`,
                      borderColor: severityColors.border,
                    },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMore sx={{ color: severityColors.border, fontSize: 18 }} />}
                    sx={{
                      py: 1,
                      px: 1.5,
                      minHeight: 'auto',
                      '& .MuiAccordionSummary-content': {
                        alignItems: 'center',
                        gap: 1,
                        my: 0,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1, minWidth: 0 }}>
                      <Box sx={{ mt: 0.25 }}>
                        {getSeverityIcon(error.severity)}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 700, 
                            color: 'text.primary', 
                            mb: 0.25,
                            fontSize: '0.8rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {error.job_name || error.table || error.error_id}
                        </Typography>
                        {error.table && error.job_name && (
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'text.secondary', 
                              fontSize: '0.65rem', 
                              display: 'block', 
                              mb: 0.25,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {error.table}
                          </Typography>
                        )}
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.7rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                            mb: 0.25,
                          }}
                        >
                          {error.message}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AccessTime sx={{ fontSize: 10, color: 'text.secondary' }} />
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                            {formatTimeAgo(error.occurred_at)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, ml: 0.5 }}>
                        <Chip
                          label={error.severity}
                          size="small"
                          sx={{
                            backgroundColor: severityColors.bg,
                            color: severityColors.text,
                            fontWeight: 700,
                            fontSize: '0.6rem',
                            height: '18px',
                            minWidth: 'fit-content',
                            px: 0.5,
                          }}
                        />
                        {error.retry_count > 0 && (
                          <Chip
                            icon={<Refresh sx={{ fontSize: 10 }} />}
                            label={error.retry_count}
                            size="small"
                            sx={{
                              backgroundColor: '#6366f120',
                              color: '#6366f1',
                              fontWeight: 600,
                              fontSize: '0.6rem',
                              height: '16px',
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 1.5, pb: 1.5, pt: 0 }}>
                    <Box sx={{ pl: 3.5 }}>
                      <Typography variant="body2" sx={{ mb: 1.5, color: 'text.primary', fontSize: '0.8rem', lineHeight: 1.5 }}>
                        {error.message}
                      </Typography>
                      <Grid container spacing={1.5}>
                        <Grid item xs={6} sm={4}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25, fontSize: '0.65rem' }}>
                              Type
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                              {error.type.replace('_', ' ')}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6} sm={4}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25, fontSize: '0.65rem' }}>
                              Occurred At
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                              {new Date(error.occurred_at).toLocaleString()}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25, fontSize: '0.65rem' }}>
                              Status
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                              {error.status}
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
        </Box>
      </CardContent>
    </Card>
  );
};

