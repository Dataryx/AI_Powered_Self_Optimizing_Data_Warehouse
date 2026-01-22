/**
 * Query Analytics Component
 * Displays query distribution and slow query analysis
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
} from '@mui/material';
import { Refresh, QueryStats, TrendingUp, TrendingDown } from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { apiService } from '../../services/api';

interface QueryAnalyticsProps {
  refreshKey?: number;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export const QueryAnalytics: React.FC<QueryAnalyticsProps> = ({ refreshKey = 0 }) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchAnalytics = useCallback(async () => {
    try {
      // Using query performance data for analytics
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      
      const data = await apiService.getQueryPerformance(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        undefined,
        50
      );
      
      // Process data for charts
      const metrics = data.metrics || [];
      const slowQueries = metrics.filter((m: any) => m.avg_execution_time > 1).slice(0, 5);
      
      setAnalytics({
        totalQueries: metrics.length,
        slowQueries: slowQueries.length,
        avgExecutionTime: metrics.length > 0
          ? metrics.reduce((sum: number, m: any) => sum + m.avg_execution_time, 0) / metrics.length
          : 0,
        slowQueriesList: slowQueries,
        queryDistribution: metrics.slice(0, 6).map((m: any, idx: number) => ({
          name: `Query ${idx + 1}`,
          value: m.execution_count,
          time: m.avg_execution_time,
        })),
      });
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching query analytics:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [fetchAnalytics, refreshKey]);

  if (loading && !analytics) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading query analytics...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
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
          background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
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
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QueryStats sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                Query Analytics
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                Query distribution and performance
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={fetchAnalytics}
            size="small"
            sx={{
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              color: '#6366f1',
              '&:hover': {
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
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

        {/* Stats */}
        {analytics && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <Chip
              label={`${analytics.totalQueries} queries`}
              size="small"
              sx={{
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#6366f1',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
            <Chip
              icon={<TrendingUp sx={{ fontSize: 12 }} />}
              label={`${analytics.slowQueries} slow`}
              size="small"
              sx={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
            <Chip
              label={`Avg: ${analytics.avgExecutionTime.toFixed(2)}s`}
              size="small"
              sx={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
          </Box>
        )}

        {/* Charts */}
        {analytics && analytics.queryDistribution.length > 0 ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Query Distribution
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.queryDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.queryDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5, display: 'block' }}>
                Execution Time
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.queryDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                  <RechartsTooltip />
                  <Bar dataKey="time" fill="#6366f1" radius={[4, 4, 0, 0]}>
                    {analytics.queryDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No query analytics data available
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

