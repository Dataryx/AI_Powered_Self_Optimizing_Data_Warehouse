/**
 * Optimization History Component
 * Timeline-style history of applied optimizations - Designed for auditability
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Paper,
  Divider,
} from '@mui/material';
import { History, CheckCircle, Person } from '@mui/icons-material';
import { apiService } from '../../services/api';

interface HistoryItem {
  recommendation_id: string;
  type: string;
  table: string;
  schema?: string;
  columns?: string[];
  priority?: string;
  severity?: string;
  created_at: string;
  applied_at?: string;
  applied_by?: string;
  affected_queries?: number;
  status?: string;
}

interface OptimizationHistoryProps {
  refreshKey?: number;
}

export const OptimizationHistory: React.FC<OptimizationHistoryProps> = ({
  refreshKey = 0,
}) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiService.getOptimizationHistory(100);
      setHistory(data.history || data.data?.history || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching optimization history:', err);
      setHistory([]);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [fetchHistory, refreshKey]);

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'index':
        return { bg: '#6366f1', light: '#e0e7ff', text: '#4338ca' };
      case 'partition':
        return { bg: '#10b981', light: '#d1fae5', text: '#059669' };
      case 'cache':
        return { bg: '#f59e0b', light: '#fef3c7', text: '#92400e' };
      default:
        return { bg: '#64748b', light: '#f1f5f9', text: '#475569' };
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return { bg: '#ef4444', light: '#fef2f2', text: '#991b1b' };
      case 'medium':
        return { bg: '#f59e0b', light: '#fef3c7', text: '#92400e' };
      case 'low':
        return { bg: '#6366f1', light: '#e0e7ff', text: '#4338ca' };
      default:
        return { bg: '#64748b', light: '#f1f5f9', text: '#475569' };
    }
  };

  const formatTimestamp = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getNoActionTaken = (item: HistoryItem) => {
    const status = (item.status || '').toLowerCase();
    // Treat common non-applied outcomes as “no action taken”
    return (
      status.includes('rejected') ||
      status.includes('dismissed') ||
      status.includes('no_action') ||
      status.includes('no action') ||
      status.includes('reviewed') ||
      status.includes('skipped')
    );
  };

  return (
    <Card
      elevation={0}
      sx={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 2,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <History sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: '#0f172a',
                fontSize: '1rem',
                mb: 0.25,
              }}
            >
              Optimization History
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: '#64748b', fontSize: '0.75rem' }}
            >
              Applied optimizations timeline
            </Typography>
          </Box>
          {history.length > 0 && (
            <Chip
              label={history.length}
              size="small"
              sx={{
                backgroundColor: '#f1f5f9',
                color: '#475569',
                fontWeight: 600,
                fontSize: '0.75rem',
                height: '24px',
              }}
            />
          )}
        </Box>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Loading optimization history...
            </Typography>
          </Box>
        ) : history.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <History sx={{ fontSize: 40, color: '#94a3b8', mb: 1.5 }} />
            <Typography
              variant="body2"
              sx={{ color: '#64748b', fontSize: '0.875rem' }}
            >
              No optimization history available
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {history.map((item, index) => {
              const typeColors = getTypeColor(item.type);
              const severityColors = getSeverityColor(item.severity || item.priority);
              const target = item.schema ? `${item.schema}.${item.table}` : item.table;
              const noActionTaken = getNoActionTaken(item);

              return (
                <React.Fragment key={item.recommendation_id || index}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 1.5,
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: typeColors.bg,
                        boxShadow: `0 2px 8px ${typeColors.light}`,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: '#0f172a',
                            fontSize: '0.875rem',
                            mb: 0.75,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={target}
                        >
                          {target}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                          <Chip
                            label={item.type}
                            size="small"
                            sx={{
                              height: '20px',
                              fontSize: '0.6875rem',
                              backgroundColor: typeColors.light,
                              color: typeColors.text,
                              fontWeight: 600,
                              textTransform: 'capitalize',
                            }}
                          />
                          {(item.severity || item.priority) && (
                            <Chip
                              label={item.severity || item.priority}
                              size="small"
                              sx={{
                                height: '20px',
                                fontSize: '0.6875rem',
                                backgroundColor: severityColors.light,
                                color: severityColors.text,
                                fontWeight: 600,
                                textTransform: 'capitalize',
                              }}
                            />
                          )}
                          {noActionTaken && (
                            <Chip
                              label="Reviewed — no action taken"
                              size="small"
                              sx={{
                                height: '20px',
                                fontSize: '0.6875rem',
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                                fontWeight: 600,
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                      <CheckCircle
                        sx={{
                          fontSize: 18,
                          color: noActionTaken ? '#94a3b8' : '#10b981',
                          ml: 1,
                        }}
                      />
                    </Box>

                    <Divider sx={{ my: 1.5, borderColor: '#e2e8f0' }} />

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                          Applied At
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#0f172a', fontSize: '0.8125rem' }}>
                          {formatTimestamp(item.applied_at || item.created_at)}
                        </Typography>
                      </Box>
                      {item.affected_queries !== undefined && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                            Affected Queries
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.8125rem' }}>
                            {item.affected_queries.toLocaleString()}
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                          Applied By
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Person sx={{ fontSize: 14, color: '#64748b' }} />
                          <Typography variant="body2" sx={{ fontWeight: 500, color: '#0f172a', fontSize: '0.8125rem' }}>
                            {noActionTaken
                              ? 'Recommendation reviewed — no action taken'
                              : (item.applied_by || 'ML Engine – Advisory approved')}
                          </Typography>
                        </Box>
                      </Box>
                      {item.columns && item.columns.length > 0 && (
                        <Box>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5, fontSize: '0.75rem' }}>
                            Columns
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {item.columns.map((col, idx) => (
                              <Chip
                                key={idx}
                                label={col}
                                size="small"
                                sx={{
                                  height: '18px',
                                  fontSize: '0.625rem',
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                  fontWeight: 500,
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                  {index < history.length - 1 && <Divider sx={{ borderColor: '#e2e8f0' }} />}
                </React.Fragment>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
