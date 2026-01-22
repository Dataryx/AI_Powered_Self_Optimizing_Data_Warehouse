/**
 * Data Growth Trends Component
 * Enhanced with real-time updates
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Grid, 
  Chip, 
  IconButton,
  Tooltip,
} from '@mui/material';
import { Refresh, TrendingUp, TrendingDown, ShowChart } from '@mui/icons-material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { apiService } from '../../services/api';

interface TrendPoint {
  date: string;
  bronze: number;
  silver: number;
  gold: number;
}

interface TrendData {
  bronze: {
    current_size: number;
    daily_growth: number;
    growth_rate_percent: number;
  };
  silver: {
    current_size: number;
    daily_growth: number;
    growth_rate_percent: number;
  };
  gold: {
    current_size: number;
    daily_growth: number;
    growth_rate_percent: number;
  };
  trend_points: TrendPoint[];
  period_days: number;
}

interface GrowthTrendsProps {
  refreshKey?: number;
}

export const GrowthTrends: React.FC<GrowthTrendsProps> = ({ refreshKey = 0 }) => {
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchTrends = useCallback(async () => {
    try {
      const data = await apiService.getGrowthTrends(days);
      setTrends(data);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching growth trends:', err);
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchTrends();
    const interval = setInterval(fetchTrends, 120000); // Refresh every 2 minutes
    return () => clearInterval(interval);
  }, [fetchTrends, refreshKey]);

  if (loading && !trends) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading growth trends...</Typography>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no trends data
  if (!trends) {
    return (
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #f59e0b 0%, #6366f1 50%, #10b981 100%)',
          },
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #6366f1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShowChart sx={{ color: 'white', fontSize: 28 }} />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #6366f1 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontSize: '1.25rem',
                  }}
                >
                  Data Growth Trends
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  API unavailable
                </Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
              No data available
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              Unable to connect to the API. Please check your connection.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const chartData = (trends.trend_points || []).map((point) => ({
    ...point,
    bronze: point.bronze || 0,
    silver: point.silver || 0,
    gold: point.gold || 0,
    bronze_mb: (point.bronze || 0) / 1000,
    silver_mb: (point.silver || 0) / 1000,
    gold_mb: (point.gold || 0) / 1000,
  }));

  const layers = ['bronze', 'silver', 'gold'] as const;
  const layerNames = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
  const layerColors = { bronze: '#f59e0b', silver: '#6366f1', gold: '#10b981' };

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #f59e0b 0%, #6366f1 50%, #10b981 100%)',
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #f59e0b 0%, #6366f1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShowChart sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #6366f1 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: '1.25rem',
                }}
              >
                Data Growth Trends
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                Updated: {lastUpdate.toLocaleTimeString()}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {[7, 30, 90].map((d) => (
                <Chip
                  key={d}
                  label={`${d}d`}
                  size="small"
                  onClick={() => setDays(d)}
                  sx={{
                    backgroundColor: days === d ? '#6366f1' : 'transparent',
                    color: days === d ? 'white' : '#6366f1',
                    border: '1px solid #6366f1',
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: '#6366f1',
                      color: 'white',
                    },
                  }}
                />
              ))}
            </Box>
            <Tooltip title="Refresh">
              <IconButton
                onClick={fetchTrends}
                size="small"
                sx={{
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  color: '#6366f1',
                  '&:hover': {
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s',
                }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Growth Chart */}
        <Box sx={{ width: '100%', height: 400, mb: 3 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBronze" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSilver" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: '11px' }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '11px' }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                }}
                formatter={(value: number) => [`${(value / 1000).toFixed(1)}K rows`, '']}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Legend />
              {trends.bronze && (
                <Area
                  type="monotone"
                  dataKey="bronze"
                  stroke="#f59e0b"
                  fill="url(#colorBronze)"
                  name="Bronze"
                  strokeWidth={2.5}
                  animationDuration={1000}
                />
              )}
              {trends.silver && (
                <Area
                  type="monotone"
                  dataKey="silver"
                  stroke="#6366f1"
                  fill="url(#colorSilver)"
                  name="Silver"
                  strokeWidth={2.5}
                  animationDuration={1000}
                />
              )}
              {trends.gold && (
                <Area
                  type="monotone"
                  dataKey="gold"
                  stroke="#10b981"
                  fill="url(#colorGold)"
                  name="Gold"
                  strokeWidth={2.5}
                  animationDuration={1000}
                />
              )}
              <ReferenceLine x={new Date().toISOString().split('T')[0]} stroke="#64748b" strokeDasharray="5 5" label="Today" />
            </AreaChart>
          </ResponsiveContainer>
        </Box>

        {/* Growth Statistics */}
        <Grid container spacing={2}>
          {layers.map((layer) => {
            const layerData = trends[layer];
            if (!layerData) return null; // Skip if layer data is missing
            
            const layerColor = layerColors[layer];
            const isGrowing = (layerData.daily_growth || 0) > 0;
            const TrendIcon = isGrowing ? TrendingUp : TrendingDown;

            return (
              <Grid item xs={12} md={4} key={layer}>
                <Card
                  sx={{
                    p: 2.5,
                    background: `linear-gradient(135deg, ${layerColor}08 0%, rgba(255,255,255,0.95) 100%)`,
                    border: `2px solid ${layerColor}30`,
                    borderRadius: 2,
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: `0 12px 24px ${layerColor}30`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: layerColor, fontSize: '1.1rem' }}>
                      {layerNames[layer]} Layer
                    </Typography>
                    <TrendIcon sx={{ color: isGrowing ? '#10b981' : '#ef4444', fontSize: 28 }} />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontSize: '0.75rem' }}>
                      Daily Growth
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: layerColor, fontSize: '1.5rem' }}>
                      {isGrowing ? '+' : ''}
                      {(layerData.daily_growth || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} rows/day
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontSize: '0.75rem' }}>
                      Growth Rate
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.95rem' }}>
                      {(layerData.growth_rate_percent || 0) > 0 ? '+' : ''}
                      {(layerData.growth_rate_percent || 0).toFixed(4)}% per day
                    </Typography>
                  </Box>

                  <Box sx={{ pt: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontSize: '0.75rem' }}>
                      Current Size
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: layerColor, fontSize: '0.95rem' }}>
                      {(layerData.current_size || 0).toLocaleString()} rows
                    </Typography>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
};
