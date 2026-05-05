/**
 * Index Recommendations Component
 * ML-generated optimization suggestions - Advisory only, no apply buttons
 */

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Paper,
} from '@mui/material';
import { Storage, TrendingUp, CheckCircle } from '@mui/icons-material';

interface Recommendation {
  recommendation_id: string;
  type: string;
  table: string;
  columns: string[];
  estimated_improvement?: number;
  cost?: number;
  priority?: string;
  status?: string;
  created_at?: string;
  query_count?: number;
  explanation?: string;
  impact?: {
    latency?: 'decrease' | 'increase';
    cost?: 'decrease' | 'increase';
    storage?: 'increase';
  };
}

interface IndexRecommendationsProps {
  /** From API / shared optimization hook (parent owns one WebSocket). */
  recommendations: Recommendation[] | null;
  error: string | null;
  loading: boolean;
}

export const IndexRecommendations: React.FC<IndexRecommendationsProps> = ({
  recommendations: recs,
  error,
  loading,
}) => {
  const recommendations: Recommendation[] = (recs ?? []) as Recommendation[];

  const buildImpact = (rec: Recommendation) => {
    // Prefer explicit API-provided impact, otherwise use safe heuristic defaults (UI-only)
    if (rec.impact) return rec.impact;
    return {
      latency: 'decrease' as const,
      cost: rec.cost !== undefined && rec.cost > 0 ? ('increase' as const) : ('decrease' as const),
      storage: 'increase' as const,
    };
  };

  const buildRationaleLine = (rec: Recommendation) => {
    // Trigger (best-effort)
    const explanation = rec.explanation?.trim();
    const triggerFromExplanation =
      explanation && explanation.length > 0
        ? explanation.split('.').shift()?.trim()
        : undefined;
    const trigger =
      triggerFromExplanation ||
      (rec.priority?.toLowerCase() === 'high'
        ? 'High latency or high-impact access pattern'
        : rec.priority?.toLowerCase() === 'medium'
          ? 'Moderate performance opportunity detected'
          : 'Frequent scans detected');

    // Observation window (best-effort)
    const anyRec = rec as any;
    const windowDays =
      anyRec.observation_window_days ??
      anyRec.window_days ??
      anyRec.lookback_days ??
      undefined;
    const windowQueries = rec.query_count ?? anyRec.window_queries ?? anyRec.lookback_queries ?? undefined;

    const windowLabel =
      typeof windowDays === 'number'
        ? `last ${windowDays} days`
        : typeof windowQueries === 'number'
          ? `last ${windowQueries} queries`
          : 'recent executions';

    return `Why: ${trigger} • Window: ${windowLabel}` as const;
  };

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
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Storage sx={{ color: 'white', fontSize: 20 }} />
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
              Index Recommendations
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: '#64748b', fontSize: '0.75rem' }}
            >
              ML-generated optimization suggestions
            </Typography>
          </Box>
        </Box>

        {error && (
          <Typography variant="caption" sx={{ color: '#b91c1c', display: 'block', mb: 2 }}>
            {error}
          </Typography>
        )}

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
              No index recommendations available
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: '#94a3b8', fontSize: '0.75rem' }}
            >
              All tables are optimally indexed
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recommendations.map((rec, idx) => {
              const severity = getSeverityColor(rec.priority);
              const impact = buildImpact(rec);
              return (
                <Paper
                  key={`${rec.recommendation_id}-${idx}`}
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
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                        {rec.columns?.map((col, idx) => (
                          <Chip
                            key={idx}
                            label={col}
                            size="small"
                            sx={{
                              height: '20px',
                              fontSize: '0.6875rem',
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              fontWeight: 500,
                            }}
                          />
                        ))}
                      </Box>
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
                      }}
                    >
                      {rec.explanation}
                    </Typography>
                  )}

                  {/* Potential Impact Indicators (no numbers) */}
                  {(impact.latency || impact.cost || impact.storage) && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.25 }}>
                      {impact.latency && (
                        <Chip
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

                  {rec.estimated_improvement && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                      <TrendingUp sx={{ fontSize: 14, color: '#10b981' }} />
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#10b981',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        Estimated improvement: {(rec.estimated_improvement * 100).toFixed(1)}%
                      </Typography>
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
            Recommendations are updated based on post-execution performance.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
