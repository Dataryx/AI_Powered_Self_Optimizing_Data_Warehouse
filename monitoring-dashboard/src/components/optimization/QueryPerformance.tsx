/**
 * Query Performance Component
 * Displays query performance metrics and analysis
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Refresh, Speed, TrendingUp, TrendingDown } from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { apiService } from '../../services/api';

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
  refreshKey?: number;
}

export const QueryPerformance: React.FC<QueryPerformanceProps> = ({ refreshKey = 0 }) => {
  const [metrics, setMetrics] = useState<QueryMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [timeRange, setTimeRange] = useState('7');

  const fetchMetrics = useCallback(async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange));
      
      const data = await apiService.getQueryPerformance(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        undefined,
        100
      );
      setMetrics(data.metrics || []);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching query performance:', err);
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshKey]);

  const chartData = metrics.slice(0, 10).map((metric) => ({
    name: metric.query_id.substring(0, 8) + '...',
    avg: metric.avg_execution_time,
    p95: metric.p95_execution_time,
    p99: metric.p99_execution_time,
  }));

  const avgExecutionTime = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.avg_execution_time, 0) / metrics.length
    : 0;

  if (loading && metrics.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading query performance...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(236, 72, 153, 0.2)',
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
          background: 'linear-gradient(90deg, #ec4899 0%, #f59e0b 50%, #10b981 100%)',
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
                background: 'linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Speed sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                Query Performance
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                Execution time analysis
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel sx={{ fontSize: '0.7rem' }}>Range</InputLabel>
              <Select
                value={timeRange}
                label="Range"
                onChange={(e) => setTimeRange(e.target.value)}
                sx={{ fontSize: '0.75rem', height: '28px' }}
              >
                <MenuItem value="7">7 days</MenuItem>
                <MenuItem value="30">30 days</MenuItem>
                <MenuItem value="90">90 days</MenuItem>
              </Select>
            </FormControl>
            <Chip
              label={metrics.length}
              size="small"
              sx={{
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
                color: '#ec4899',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
            <IconButton
              onClick={fetchMetrics}
              size="small"
              sx={{
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
                color: '#ec4899',
                '&:hover': {
                  backgroundColor: 'rgba(236, 72, 153, 0.2)',
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

        {/* Stats */}
        {metrics.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <Chip
              icon={<TrendingUp sx={{ fontSize: 12 }} />}
              label={`Avg: ${avgExecutionTime.toFixed(2)}s`}
              size="small"
              sx={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
            <Chip
              label={`${metrics.length} queries`}
              size="small"
              sx={{
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#6366f1',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
          </Box>
        )}

        {/* Chart */}
        {chartData.length > 0 ? (
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  stroke="#64748b"
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  stroke="#64748b"
                  label={{ value: 'Time (s)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                  }}
                />
                <Bar dataKey="avg" fill="#6366f1" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#8b5cf6'} />
                  ))}
                </Bar>
                <Bar dataKey="p95" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No query performance data available
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

