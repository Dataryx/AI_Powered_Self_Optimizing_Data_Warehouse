/**
 * Error and Retry Tracker Component
 * Displays ETL errors and retry tracking with modern design
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Chip, Grid, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { Error as ErrorIcon, Warning, Info, ExpandMore, Refresh } from '@mui/icons-material';
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
}

interface ErrorRetryTrackerProps {
  refreshKey?: number;
}

export const ErrorRetryTracker: React.FC<ErrorRetryTrackerProps> = ({ refreshKey = 0 }) => {
  const [errors, setErrors] = useState<ETLError[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchErrors();
    const interval = setInterval(fetchErrors, 12000); // Refresh every 12 seconds for error tracking
    return () => clearInterval(interval);
  }, [refreshKey]); // Re-run when refreshKey changes

  const fetchErrors = async () => {
    try {
      const data = await apiService.getETLErrors();
      setErrors(data.errors || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching ETL errors:', err);
      setLoading(false);
    }
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

  if (loading) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading error tracking...</Typography>
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
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
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
              background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '1.1rem',
            }}
          >
            Error & Retry Tracker
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              label={`${errorCounts.active} Active`}
              size="small"
              sx={{
                backgroundColor: '#ef444420',
                color: '#ef4444',
                fontWeight: 700,
                fontSize: '0.75rem',
              }}
            />
            <Chip
              label={`${errorCounts.total} Total`}
              size="small"
              sx={{
                backgroundColor: '#64748b20',
                color: '#64748b',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          </Box>
        </Box>

        {activeErrors.length === 0 ? (
          <Box
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: 2,
              background: 'linear-gradient(135deg, #10b98110 0%, rgba(255,255,255,0.8) 100%)',
              border: '2px solid #10b98130',
            }}
          >
            <ErrorIcon sx={{ color: '#10b981', fontSize: 48, mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#10b981', mb: 1 }}>
              No Active Errors
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              All ETL processes are running smoothly
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {activeErrors.slice(0, 5).map((error) => {
              const severityColors = getSeverityColor(error.severity);
              return (
                <Accordion
                  key={error.error_id}
                  sx={{
                    background: `linear-gradient(135deg, ${severityColors.bg}10 0%, rgba(255,255,255,0.9) 100%)`,
                    border: `2px solid ${severityColors.border}40`,
                    borderRadius: 2,
                    boxShadow: 'none',
                    '&:before': { display: 'none' },
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 4px 12px ${severityColors.border}30`,
                    },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMore sx={{ color: severityColors.border }} />}
                    sx={{
                      '& .MuiAccordionSummary-content': {
                        alignItems: 'center',
                        gap: 2,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                      {getSeverityIcon(error.severity)}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                          {error.table || error.error_id}
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
                          {error.message}
                        </Typography>
                      </Box>
                      <Chip
                        label={error.severity}
                        size="small"
                        sx={{
                          backgroundColor: severityColors.bg,
                          color: severityColors.text,
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          height: '22px',
                          minWidth: '60px',
                        }}
                      />
                      {error.retry_count > 0 && (
                        <Chip
                          icon={<Refresh sx={{ fontSize: 14 }} />}
                          label={`${error.retry_count} retries`}
                          size="small"
                          sx={{
                            backgroundColor: '#6366f120',
                            color: '#6366f1',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ pl: 6 }}>
                      <Typography variant="body2" sx={{ mb: 1, color: 'text.primary' }}>
                        {error.message}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            Type
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {error.type}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            Occurred At
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {new Date(error.occurred_at).toLocaleString()}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            Status
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {error.status}
                          </Typography>
                        </Box>
                      </Box>
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

