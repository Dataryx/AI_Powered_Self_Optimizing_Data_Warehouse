/**
 * Cost Tracker Component
 * Enhanced with real-time updates
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Grid,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Refresh, AttachMoney, TrendingUp } from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { apiService } from '../../services/api';

interface CostBreakdown {
  storage_gb: number;
  monthly_cost: number;
  yearly_cost: number;
}

interface CostData {
  breakdown: {
    [key: string]: CostBreakdown;
  };
  total: {
    monthly_cost: number;
    yearly_cost: number;
  };
  currency: string;
}

interface CostTrackerProps {
  refreshKey?: number;
}

export const CostTracker: React.FC<CostTrackerProps> = ({ refreshKey = 0 }) => {
  const [costs, setCosts] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchCosts = useCallback(async () => {
    try {
      const data = await apiService.getCostTracking();
      setCosts(data);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching cost tracking:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCosts();
    const interval = setInterval(fetchCosts, 120000);
    return () => clearInterval(interval);
  }, [fetchCosts, refreshKey]);

  if (loading && !costs) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading cost tracking...</Typography>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no cost data
  if (!costs) {
    return (
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
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
                  background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AttachMoney sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontSize: '1.1rem',
                  }}
                >
                  Cost Tracking
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  API unavailable
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Refresh">
              <IconButton
                onClick={fetchCosts}
                size="small"
                sx={{
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  color: '#f59e0b',
                  '&:hover': {
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s',
                }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No cost tracking data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const layers = ['bronze', 'silver', 'gold'] as const;
  const layerNames = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
  const layerColors = { bronze: '#f59e0b', silver: '#6366f1', gold: '#10b981' };

  // Prepare pie chart data
  const pieData = layers.map((layer) => ({
    name: layerNames[layer],
    value: costs.breakdown[layer]?.monthly_cost || 0,
    color: layerColors[layer],
  }));

  // Prepare bar chart data
  const barData = layers.map((layer) => ({
    layer: layerNames[layer],
    monthly: costs.breakdown[layer]?.monthly_cost || 0,
    yearly: costs.breakdown[layer]?.yearly_cost || 0,
    color: layerColors[layer],
  }));

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        maxHeight: '600px',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
        },
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1,
                background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AttachMoney sx={{ color: 'white', fontSize: 16 }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: '0.85rem',
                  lineHeight: 1.2,
                  mb: 0.25,
                }}
              >
                Cost Tracking
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                Updated: {lastUpdate.toLocaleTimeString()}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                px: 1.25,
                py: 0.5,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                color: 'white',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6rem', display: 'block' }}>
                Total Monthly
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
                ${costs.total.monthly_cost.toFixed(2)}
              </Typography>
            </Box>
            <Tooltip title="Refresh">
              <IconButton
                onClick={fetchCosts}
                size="small"
                sx={{
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  color: '#f59e0b',
                  width: '28px',
                  height: '28px',
                  '&:hover': {
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s',
                }}
              >
                <Refresh sx={{ fontSize: '14px' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
          {/* Pie Chart */}
          <Grid item xs={12} md={4}>
            <Box 
              sx={{ 
                width: '100%', 
                height: 180,
                p: 1,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, rgba(255,255,255,0.5) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.1)',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, textAlign: 'center', fontSize: '0.7rem' }}>
                Monthly Cost by Layer
              </Typography>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value, percent }) => `${name}\n$${value.toFixed(2)}\n${(percent * 100).toFixed(1)}%`}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number, name: string) => [
                      `$${value.toFixed(2)} (${((value / costs.total.monthly_cost) * 100).toFixed(1)}%)`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          {/* Bar Chart */}
          <Grid item xs={12} md={8}>
            <Box 
              sx={{ 
                width: '100%', 
                height: 180,
                p: 1,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, rgba(255,255,255,0.5) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.1)',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.7rem' }}>
                Monthly vs Yearly Costs
              </Typography>
              <ResponsiveContainer>
                <BarChart data={barData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="layer" stroke="#64748b" style={{ fontSize: '9px' }} />
                  <YAxis
                    stroke="#64748b"
                    style={{ fontSize: '9px' }}
                    width={35}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.98)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      borderRadius: 8,
                      fontSize: '10px',
                      padding: '4px 8px',
                    }}
                    formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                    iconSize={10}
                  />
                  <Bar dataKey="monthly" name="Monthly" radius={[4, 4, 0, 0]} animationDuration={1000} barSize={30}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-monthly-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                  <Bar dataKey="yearly" name="Yearly" radius={[4, 4, 0, 0]} animationDuration={1000} barSize={30}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-yearly-${index}`} fill={`${entry.color}80`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
        </Grid>

        {/* Cost Breakdown Cards */}
        <Grid container spacing={1}>
          {layers.map((layer) => {
            const layerData = costs.breakdown[layer];
            if (!layerData) return null;

            const layerColor = layerColors[layer];

            return (
              <Grid item xs={12} sm={4} key={layer}>
                <Card
                  sx={{
                    p: 1.25,
                    background: `linear-gradient(135deg, ${layerColor}08 0%, rgba(255,255,255,0.9) 100%)`,
                    border: `1.5px solid ${layerColor}40`,
                    borderRadius: 1.5,
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: `0 4px 8px ${layerColor}30`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <AttachMoney sx={{ color: layerColor, fontSize: 18 }} />
                    <Typography variant="body2" sx={{ fontWeight: 700, color: layerColor, fontSize: '0.8rem' }}>
                      {layerNames[layer]} Layer
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.4, fontSize: '0.65rem' }}>
                      Storage
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}>
                      {layerData.storage_gb.toFixed(2)} GB
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.4, fontSize: '0.65rem' }}>
                      Monthly Cost
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: layerColor, fontSize: '1rem' }}>
                        ${layerData.monthly_cost.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        /month
                      </Typography>
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.4, fontSize: '0.65rem' }}>
                      Yearly Cost
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TrendingUp sx={{ color: layerColor, fontSize: 12 }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: layerColor, fontSize: '0.8rem' }}>
                        ${layerData.yearly_cost.toFixed(2)}
                      </Typography>
                    </Box>
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
