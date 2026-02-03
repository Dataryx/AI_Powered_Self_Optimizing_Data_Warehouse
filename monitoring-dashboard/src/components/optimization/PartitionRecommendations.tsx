/**
 * Partition Recommendations Component
 * ML-generated partitioning suggestions - Advisory only
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Paper,
} from '@mui/material';
import { TableChart, TrendingDown, TrendingUp, CheckCircle } from '@mui/icons-material';
import { apiService } from '../../services/api';

interface Recommendation {
  recommendation_id: string;
  type: string;
  table: string;
  partition_column?: string;
  estimated_improvement?: number;
  cost?: number;
  priority?: string;
  status?: string;
  created_at?: string;
  impact?: {
    latency?: 'decrease' | 'increase';
    cost?: 'decrease' | 'increase';
    storage?: 'increase';
  };
  explanation?: string;
}

interface PartitionRecommendationsProps {
  refreshKey?: number;
}

export const PartitionRecommendations: React.FC<PartitionRecommendationsProps> = ({
  refreshKey = 0,
}) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const buildRationaleLine = (rec: Recommendation) => {
    const explanation = rec.explanation?.trim();
    const triggerFromExplanation =
      explanation && explanation.length > 0
        ? explanation.split('.').shift()?.trim()
        : undefined;

    const trigger =
      triggerFromExplanation ||
      (rec.priority?.toLowerCase() === 'high'
        ? 'High latency due to wide scans'
        : rec.priority?.toLowerCase() === 'medium'
          ? 'Scan pruning opportunity detected'
          : 'Frequent range filters detected');

    const anyRec = rec as any;
    const windowDays =
      anyRec.observation_window_days ??
      anyRec.window_days ??
      anyRec.lookback_days ??
      undefined;
    const windowQueries = anyRec.query_count ?? anyRec.window_queries ?? anyRec.lookback_queries ?? undefined;

    const windowLabel =
      typeof windowDays === 'number'
        ? `last ${windowDays} days`
        : typeof windowQueries === 'number'
          ? `last ${windowQueries} queries`
          : 'recent executions';

    return `Why: ${trigger} • Window: ${windowLabel}` as const;
  };

  const fetchRecommendations = useCallback(async () => {
    try {
      const data = await apiService.getOptimizationRecommendations('partition', 'pending');
      setRecommendations(data.recommendations || data.data?.recommendations || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching partition recommendations:', err);
      setRecommendations([]);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
    const interval = setInterval(fetchRecommendations, 30000);
    return () => clearInterval(interval);
  }, [fetchRecommendations, refreshKey]);

  const getSeverityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
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

  return (
    <Card
      elevation={0}
      sx={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 2,
        height: '100%',
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
            <TableChart sx={{ color: 'white', fontSize: 20 }} />
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
              Partition Recommendations
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: '#64748b', fontSize: '0.75rem' }}
            >
              Partitioning suggestions for optimal performance
            </Typography>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Loading recommendations...
            </Typography>
          </Box>
        ) : recommendations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircle sx={{ fontSize: 40, color: '#94a3b8', mb: 1.5 }} />
            <Typography
              variant="body2"
              sx={{ color: '#64748b', fontSize: '0.875rem', mb: 0.5 }}
            >
              No partition recommendations available
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: '#94a3b8', fontSize: '0.75rem' }}
            >
              All tables are optimally partitioned
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recommendations.map((rec) => {
              const severity = getSeverityColor(rec.priority);
              const impact = rec.impact || {};

              return (
                <Paper
                  key={rec.recommendation_id}
                  elevation={0}
                  sx={{
                    p: 2,
                    background: '#ffffff',
                    border: `1px solid ${severity.light}`,
                    borderRadius: 1.5,
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: severity.bg,
                      boxShadow: `0 2px 8px ${severity.light}`,
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
                        title={rec.table}
                      >
                        {rec.table}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#64748b',
                          fontSize: '0.75rem',
                          lineHeight: 1.4,
                          display: 'block',
                          mb: 1,
                        }}
                      >
                        {buildRationaleLine(rec)}
                      </Typography>
                      {rec.partition_column && (
                        <Chip
                          label={`Partition by: ${rec.partition_column}`}
                          size="small"
                          sx={{
                            height: '20px',
                            fontSize: '0.6875rem',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            fontWeight: 500,
                            mb: 1,
                          }}
                        />
                      )}
                    </Box>
                    {rec.priority && (
                      <Chip
                        label={rec.priority}
                        size="small"
                        sx={{
                          height: '22px',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          backgroundColor: severity.light,
                          color: severity.text,
                          textTransform: 'capitalize',
                          ml: 1,
                        }}
                      />
                    )}
                  </Box>

                  {rec.explanation && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#64748b',
                        fontSize: '0.75rem',
                        lineHeight: 1.5,
                        display: 'block',
                        mb: 1,
                      }}
                    >
                      {rec.explanation}
                    </Typography>
                  )}

                  {/* Potential Impact Indicators */}
                  {(impact.latency || impact.cost || impact.storage) && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {impact.latency && (
                        <Chip
                          icon={
                            impact.latency === 'decrease' ? (
                              <TrendingDown sx={{ fontSize: 14, color: '#10b981' }} />
                            ) : (
                              <TrendingUp sx={{ fontSize: 14, color: '#ef4444' }} />
                            )
                          }
                          label={`Latency ${impact.latency === 'decrease' ? '↓' : '↑'}`}
                          size="small"
                          sx={{
                            height: '22px',
                            fontSize: '0.6875rem',
                            backgroundColor: impact.latency === 'decrease' ? '#d1fae5' : '#fef2f2',
                            color: impact.latency === 'decrease' ? '#10b981' : '#ef4444',
                            fontWeight: 600,
                          }}
                        />
                      )}
                      {impact.cost && (
                        <Chip
                          icon={
                            impact.cost === 'decrease' ? (
                              <TrendingDown sx={{ fontSize: 14, color: '#10b981' }} />
                            ) : (
                              <TrendingUp sx={{ fontSize: 14, color: '#ef4444' }} />
                            )
                          }
                          label={`Cost ${impact.cost === 'decrease' ? '↓' : '↑'}`}
                          size="small"
                          sx={{
                            height: '22px',
                            fontSize: '0.6875rem',
                            backgroundColor: impact.cost === 'decrease' ? '#d1fae5' : '#fef2f2',
                            color: impact.cost === 'decrease' ? '#10b981' : '#ef4444',
                            fontWeight: 600,
                          }}
                        />
                      )}
                      {impact.storage && (
                        <Chip
                          icon={<TrendingUp sx={{ fontSize: 14, color: '#f59e0b' }} />}
                          label="Storage ↑"
                          size="small"
                          sx={{
                            height: '22px',
                            fontSize: '0.6875rem',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            fontWeight: 600,
                          }}
                        />
                      )}
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Box>
        )}

        {/* Feedback loop indicator (conceptual) */}
        <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid #e2e8f0' }}>
          <Typography
            variant="caption"
            sx={{
              color: '#94a3b8',
              fontSize: '0.75rem',
              lineHeight: 1.4,
            }}
          >
            Continuously refined using execution feedback.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
