/**
 * Errors & Retries Component
 * Minimal design with healthy state message if no errors
 * Compact list if failures exist
 * Enterprise-grade clean design
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, Typography, Box, Chip, IconButton, Paper, Divider } from '@mui/material';
import { Error as ErrorIcon, Warning, Refresh, CheckCircle } from '@mui/icons-material';
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
      <Card elevation={0} sx={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.875rem' }}>
            Loading error tracking...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (error && errors.length === 0) {
    return (
      <Card elevation={0} sx={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <ErrorIcon sx={{ color: '#ef4444', fontSize: 40, mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#0f172a', mb: 0.5, fontSize: '1rem' }}>
            Error Loading Error Tracker
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2, fontSize: '0.875rem' }}>
            {error}
          </Typography>
          <IconButton onClick={fetchErrors} sx={{ color: '#6366f1', '&:hover': { backgroundColor: '#f1f5f9' } }}>
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
    <Card elevation={0} sx={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: '#0f172a',
              fontSize: '1rem',
            }}
          >
            Errors & Retries
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {activeErrors.length > 0 && (
              <Chip
                label={`${activeErrors.length} active`}
                size="small"
                sx={{
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: '24px',
                  border: '1px solid #fecaca',
                }}
              />
            )}
            <IconButton
              size="small"
              onClick={fetchErrors}
              sx={{
                color: '#6366f1',
                '&:hover': { backgroundColor: '#f1f5f9' },
              }}
            >
              <Refresh sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        {activeErrors.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: 'center',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 1.5,
            }}
          >
            <CheckCircle sx={{ fontSize: 48, color: '#10b981', mb: 1.5 }} />
            <Typography variant="body1" sx={{ fontWeight: 600, color: '#166534', mb: 0.5, fontSize: '0.9375rem' }}>
              No Active Errors
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.875rem' }}>
              All ETL processes are running smoothly
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {activeErrors.slice(0, 10).map((error) => {
              const severityColors = getSeverityColor(error.severity);
              return (
                <Paper
                  key={error.error_id}
                  elevation={0}
                  sx={{
                    p: 2,
                    background: '#ffffff',
                    border: `1px solid ${severityColors.border}30`,
                    borderRadius: 1.5,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: severityColors.border,
                      boxShadow: `0 2px 8px ${severityColors.border}20`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Box sx={{ mt: 0.25 }}>
                      {getSeverityIcon(error.severity)}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: '#0f172a',
                            fontSize: '0.875rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {error.job_name || error.table || error.error_id}
                        </Typography>
                        <Chip
                          label={error.severity}
                          size="small"
                          sx={{
                            backgroundColor: severityColors.bg + '15',
                            color: severityColors.bg,
                            fontWeight: 600,
                            fontSize: '0.6875rem',
                            height: '20px',
                            border: `1px solid ${severityColors.border}30`,
                            ml: 1,
                          }}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#64748b',
                          fontSize: '0.75rem',
                          display: 'block',
                          mb: 1,
                          lineHeight: 1.4,
                        }}
                      >
                        {error.message}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        {error.table && (
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                            Table: {error.table}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                          {formatTimeAgo(error.occurred_at)}
                        </Typography>
                        {error.retry_count > 0 && (
                          <Chip
                            icon={<Refresh sx={{ fontSize: 12 }} />}
                            label={`${error.retry_count} retries`}
                            size="small"
                            sx={{
                              backgroundColor: '#6366f115',
                              color: '#6366f1',
                              fontWeight: 500,
                              fontSize: '0.6875rem',
                              height: '20px',
                              border: '1px solid #6366f130',
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

