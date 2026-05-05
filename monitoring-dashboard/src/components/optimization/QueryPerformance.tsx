/**
 * Query Performance Analysis Component
 * Execution time analysis with baseline explanation - Advisory only
 */

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
} from '@mui/material';
import { Speed, Info } from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
interface QueryMetric {
  query_id: string;
  query_hash: string;
  execution_count: number;
  avg_execution_time: number;
  p50_execution_time: number;
  p95_execution_time: number;
  p99_execution_time: number;
  total_execution_time: number;
  cache_hit_rate: number;
  last_executed: string;
}

interface QueryPerformanceProps {
  performanceMetrics: QueryMetric[] | null;
  error: string | null;
  loading: boolean;
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
}

export const QueryPerformance: React.FC<QueryPerformanceProps> = ({
  performanceMetrics,
  error,
  loading,
  timeRange,
  onTimeRangeChange,
}) => {
  const metrics: QueryMetric[] = (performanceMetrics ?? []) as QueryMetric[];

  // Calculate baseline (rolling median)
  const calculateBaseline = () => {
    if (metrics.length === 0) return 0;
    const sorted = [...metrics]
      .map((m) => m.avg_execution_time)
      .sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  // Prepare trend data (last 10 queries by execution time)
  const trendData = metrics
    .slice(0, 10)
    .map((metric, index) => ({
      name: `Q${index + 1}`,
      avg: metric.avg_execution_time,
      p50: metric.p50_execution_time,
      baseline: calculateBaseline(),
    }))
    .reverse();

  const baseline = calculateBaseline();
  const avgExecutionTime =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.avg_execution_time, 0) / metrics.length
      : 0;

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
              <Speed sx={{ color: 'white', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  color: '#0f172a',
                  fontSize: '1rem',
                  mb: 0.25,
                }}
              >
                Query Performance Analysis
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: '#64748b', fontSize: '0.75rem' }}
              >
                Execution time analysis
              </Typography>
            </Box>
          </Box>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel sx={{ fontSize: '0.75rem' }}>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => onTimeRangeChange(e.target.value)}
              sx={{
                fontSize: '0.875rem',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e2e8f0',
                },
              }}
            >
              <MenuItem value="7">Last 7 days</MenuItem>
              <MenuItem value="30">Last 30 days</MenuItem>
              <MenuItem value="90">Last 90 days</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {error && (
          <Typography variant="caption" sx={{ color: '#b91c1c', display: 'block', mb: 2 }}>
            {error}
          </Typography>
        )}

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Loading query performance data...
            </Typography>
          </Box>
        ) : metrics.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Speed sx={{ fontSize: 40, color: '#94a3b8', mb: 1.5 }} />
            <Typography
              variant="body2"
              sx={{ color: '#64748b', fontSize: '0.875rem', mb: 0.5 }}
            >
              No query performance data available
            </Typography>
            <Paper
              elevation={0}
              sx={{
                mt: 2,
                p: 2,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 1.5,
                maxWidth: '500px',
                mx: 'auto',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Info sx={{ fontSize: 18, color: '#6366f1', mt: 0.25 }} />
                <Typography
                  variant="caption"
                  sx={{
                    color: '#64748b',
                    fontSize: '0.75rem',
                    lineHeight: 1.5,
                  }}
                >
                  Baseline derived from rolling median of historical executions
                </Typography>
              </Box>
            </Paper>
          </Box>
        ) : (
          <>
            {/* Summary Stats */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  flex: 1,
                  minWidth: '150px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 1.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: '#64748b', display: 'block', mb: 0.5, fontSize: '0.75rem' }}
                >
                  Average Execution Time
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: '#0f172a', fontSize: '1.125rem' }}
                >
                  {avgExecutionTime.toFixed(3)}s
                </Typography>
              </Paper>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  flex: 1,
                  minWidth: '150px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 1.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: '#64748b', display: 'block', mb: 0.5, fontSize: '0.75rem' }}
                >
                  Baseline (Median)
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: '#0f172a', fontSize: '1.125rem' }}
                >
                  {baseline.toFixed(3)}s
                </Typography>
              </Paper>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  flex: 1,
                  minWidth: '150px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 1.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: '#64748b', display: 'block', mb: 0.5, fontSize: '0.75rem' }}
                >
                  Total Queries
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: '#0f172a', fontSize: '1.125rem' }}
                >
                  {metrics.length}
                </Typography>
              </Paper>
            </Box>

            {/* Trend Chart */}
            {trendData.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'block',
                    mb: 1.5,
                  }}
                >
                  Execution Time Trends (Top 10 Queries)
                </Typography>
                <Box sx={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer>
                    <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                      <XAxis
                        dataKey="name"
                        stroke="#64748b"
                        style={{ fontSize: '10px' }}
                      />
                      <YAxis
                        stroke="#64748b"
                        style={{ fontSize: '10px' }}
                        label={{ value: 'Time (s)', angle: -90, position: 'insideLeft', fontSize: '10px' }}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.98)',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          fontSize: '12px',
                        }}
                      />
                      <ReferenceLine
                        y={baseline}
                        stroke="#94a3b8"
                        strokeDasharray="5 5"
                        label={{ value: 'Baseline', position: 'right', fontSize: '10px', fill: '#64748b' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avg"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Avg Execution"
                      />
                      <Line
                        type="monotone"
                        dataKey="p50"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={{ r: 2 }}
                        name="P50"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            )}

            {/* Baseline Explanation */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Info sx={{ fontSize: 18, color: '#6366f1', mt: 0.25 }} />
                <Typography
                  variant="caption"
                  sx={{
                    color: '#64748b',
                    fontSize: '0.75rem',
                    lineHeight: 1.5,
                  }}
                >
                  Baseline derived from rolling median of historical executions. This provides a
                  stable reference point for identifying performance regressions and improvements.
                </Typography>
              </Box>
            </Paper>
          </>
        )}
      </CardContent>
    </Card>
  );
};
