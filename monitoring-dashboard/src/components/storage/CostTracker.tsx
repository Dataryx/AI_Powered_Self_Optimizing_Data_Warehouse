/**
 * Cost Tracker Component
 * Displays cost tracking and breakdown by layer
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Grid } from '@mui/material';
import { AttachMoney, TrendingUp } from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
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

export const CostTracker: React.FC = () => {
  const [costs, setCosts] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCosts();
    const interval = setInterval(fetchCosts, 120000);
    return () => clearInterval(interval);
  }, []);

  const fetchCosts = async () => {
    try {
      const data = await apiService.getCostTracking();
      setCosts(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching cost tracking:', err);
      setLoading(false);
    }
  };

  if (loading || !costs) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading cost tracking...</Typography>
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
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(245, 158, 11, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
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
          <Box
            sx={{
              px: 2,
              py: 0.5,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
              color: 'white',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', display: 'block' }}>
              Total Monthly
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
              ${costs.total.monthly_cost.toFixed(2)}
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Pie Chart */}
          <Grid item xs={12} md={4}>
            <Box sx={{ width: '100%', height: 300 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, textAlign: 'center' }}>
                Monthly Cost by Layer
              </Typography>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Monthly Cost']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          {/* Bar Chart */}
          <Grid item xs={12} md={8}>
            <Box sx={{ width: '100%', height: 300 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Monthly vs Yearly Costs
              </Typography>
              <ResponsiveContainer>
                <BarChart data={barData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="layer" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.98)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      borderRadius: 12,
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                  />
                  <Legend />
                  <Bar dataKey="monthly" name="Monthly Cost" radius={[8, 8, 0, 0]} animationDuration={1000}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-monthly-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                  <Bar dataKey="yearly" name="Yearly Cost" radius={[8, 8, 0, 0]} animationDuration={1000}>
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
        <Grid container spacing={2}>
          {layers.map((layer) => {
            const layerData = costs.breakdown[layer];
            if (!layerData) return null;

            const layerColor = layerColors[layer];

            return (
              <Grid item xs={12} sm={4} key={layer}>
                <Card
                  sx={{
                    p: 2,
                    background: `linear-gradient(135deg, ${layerColor}08 0%, rgba(255,255,255,0.9) 100%)`,
                    border: `2px solid ${layerColor}40`,
                    borderRadius: 2,
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 8px 16px ${layerColor}30`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <AttachMoney sx={{ color: layerColor, fontSize: 28 }} />
                    <Typography variant="body1" sx={{ fontWeight: 700, color: layerColor }}>
                      {layerNames[layer]} Layer
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      Storage
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '1rem' }}>
                      {layerData.storage_gb.toFixed(2)} GB
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      Monthly Cost
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: layerColor, fontSize: '1.3rem' }}>
                        ${layerData.monthly_cost.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        /month
                      </Typography>
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      Yearly Cost
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TrendingUp sx={{ color: layerColor, fontSize: 16 }} />
                      <Typography variant="body1" sx={{ fontWeight: 700, color: layerColor }}>
                        ${layerData.yearly_cost.toFixed(2)}
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Total Cost Summary */}
        <Box
          sx={{
            mt: 3,
            p: 2.5,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #f59e0b10 0%, rgba(255,255,255,0.8) 100%)',
            border: '2px solid #f59e0b30',
          }}
        >
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Total Monthly Cost
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                  ${costs.total.monthly_cost.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Total Yearly Cost
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                  ${costs.total.yearly_cost.toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Avg Monthly per GB
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  ${(costs.total.monthly_cost / Object.values(costs.breakdown).reduce((sum, b) => sum + b.storage_gb, 0) || 1).toFixed(2)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Currency
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {costs.currency}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
};

