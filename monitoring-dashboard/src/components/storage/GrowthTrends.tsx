/**
 * Data Growth Trends Component
 * Displays data growth trends over time with projections
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Grid, Chip } from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
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

export const GrowthTrends: React.FC = () => {
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchTrends();
    const interval = setInterval(fetchTrends, 120000); // Refresh every 2 minutes
    return () => clearInterval(interval);
  }, [days]);

  const fetchTrends = async () => {
    try {
      const data = await apiService.getGrowthTrends(days);
      setTrends(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching growth trends:', err);
      setLoading(false);
    }
  };

  if (loading || !trends) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading growth trends...</Typography>
        </CardContent>
      </Card>
    );
  }

  const chartData = trends.trend_points.map((point) => ({
    ...point,
    bronze_mb: point.bronze / 1000,
    silver_mb: point.silver / 1000,
    gold_mb: point.gold / 1000,
  }));

  const layers = ['bronze', 'silver', 'gold'] as const;
  const layerNames = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
  const layerColors = { bronze: '#f59e0b', silver: '#6366f1', gold: '#10b981' };

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(99, 102, 241, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '1.1rem',
            }}
          >
            Data Growth Trends
          </Typography>
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
        </Box>

        {/* Growth Chart */}
        <Box sx={{ width: '100%', height: 400, mb: 3 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBronze" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSilver" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
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
              <Tooltip
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
              <Area
                type="monotone"
                dataKey="bronze"
                stroke="#f59e0b"
                fill="url(#colorBronze)"
                name="Bronze"
                strokeWidth={2}
                animationDuration={1000}
              />
              <Area
                type="monotone"
                dataKey="silver"
                stroke="#6366f1"
                fill="url(#colorSilver)"
                name="Silver"
                strokeWidth={2}
                animationDuration={1000}
              />
              <Area
                type="monotone"
                dataKey="gold"
                stroke="#10b981"
                fill="url(#colorGold)"
                name="Gold"
                strokeWidth={2}
                animationDuration={1000}
              />
              <ReferenceLine x={new Date().toISOString().split('T')[0]} stroke="#64748b" strokeDasharray="5 5" label="Today" />
            </AreaChart>
          </ResponsiveContainer>
        </Box>

        {/* Growth Statistics */}
        <Grid container spacing={2}>
          {layers.map((layer) => {
            const layerData = trends[layer];
            const layerColor = layerColors[layer];
            const isGrowing = layerData.daily_growth > 0;

            return (
              <Grid item xs={12} md={4} key={layer}>
                <Card
                  sx={{
                    p: 2,
                    background: `linear-gradient(135deg, ${layerColor}08 0%, rgba(255,255,255,0.8) 100%)`,
                    border: `2px solid ${layerColor}30`,
                    borderRadius: 2,
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 8px 16px ${layerColor}30`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: layerColor }}>
                      {layerNames[layer]} Layer
                    </Typography>
                    {isGrowing ? (
                      <TrendingUp sx={{ color: '#10b981', fontSize: 24 }} />
                    ) : (
                      <TrendingDown sx={{ color: '#ef4444', fontSize: 24 }} />
                    )}
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      Daily Growth
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: layerColor, fontSize: '1.5rem' }}>
                      {isGrowing ? '+' : ''}
                      {layerData.daily_growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} rows/day
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      Growth Rate
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      {layerData.growth_rate_percent > 0 ? '+' : ''}
                      {layerData.growth_rate_percent.toFixed(4)}% per day
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      Current Size
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: layerColor }}>
                      {layerData.current_size.toLocaleString()} rows
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

