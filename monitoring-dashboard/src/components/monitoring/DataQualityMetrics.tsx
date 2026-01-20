/**
 * Data Quality Metrics Component
 * Displays data quality metrics per pipeline stage
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Grid, LinearProgress } from '@mui/material';
import { CheckCircle, Warning, Error as ErrorIcon } from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { apiService } from '../../services/api';

interface TableQuality {
  table: string;
  row_count: number;
  dead_rows: number;
  quality_score: number;
  status: string;
}

interface QualityMetrics {
  [key: string]: {
    tables: TableQuality[];
    average_quality_score: number;
    overall_status: string;
  };
}

interface DataQualityMetricsProps {
  refreshKey?: number;
}

export const DataQualityMetrics: React.FC<DataQualityMetricsProps> = ({ refreshKey = 0 }) => {
  const [quality, setQuality] = useState<QualityMetrics>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuality();
    const interval = setInterval(fetchQuality, 20000); // Refresh every 20 seconds for quality metrics
    return () => clearInterval(interval);
  }, [refreshKey]); // Re-run when refreshKey changes

  const fetchQuality = async () => {
    try {
      const data = await apiService.getDataQualityMetrics();
      setQuality(data.quality_metrics || {});
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data quality metrics:', err);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return { bg: '#10b981', light: '#10b98120', border: '#10b98140' };
      case 'good':
        return { bg: '#3b82f6', light: '#3b82f620', border: '#3b82f640' };
      case 'fair':
        return { bg: '#f59e0b', light: '#f59e0b20', border: '#f59e0b40' };
      case 'poor':
        return { bg: '#ef4444', light: '#ef444420', border: '#ef444440' };
      default:
        return { bg: '#64748b', light: '#64748b20', border: '#64748b40' };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return <CheckCircle sx={{ color: '#10b981', fontSize: 20 }} />;
      case 'good':
        return <CheckCircle sx={{ color: '#3b82f6', fontSize: 20 }} />;
      case 'fair':
        return <Warning sx={{ color: '#f59e0b', fontSize: 20 }} />;
      case 'poor':
        return <ErrorIcon sx={{ color: '#ef4444', fontSize: 20 }} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading data quality metrics...</Typography>
        </CardContent>
      </Card>
    );
  }

  const layers = ['bronze', 'silver', 'gold'];
  const layerNames = { bronze: 'Bronze Layer', silver: 'Silver Layer', gold: 'Gold Layer' };
  const layerColors = { bronze: '#f59e0b', silver: '#6366f1', gold: '#10b981' };

  // Prepare chart data
  const chartData = layers.map((layer) => {
    const layerData = quality[layer];
    if (!layerData) return { layer, score: 0 };
    return {
      layer: layer.toUpperCase(),
      score: layerData.average_quality_score,
      color: layerColors[layer as keyof typeof layerColors],
    };
  });

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(16, 185, 129, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            mb: 2.5,
            background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: '1.1rem',
          }}
        >
          Data Quality Metrics
        </Typography>

        {/* Overall Quality Chart */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis
                  dataKey="layer"
                  stroke="#64748b"
                  style={{ fontSize: '12px', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#64748b"
                  style={{ fontSize: '12px', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: 12,
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Quality Score']}
                />
                <Bar dataKey="score" radius={[8, 8, 0, 0]} animationDuration={1000}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {/* Layer Quality Details */}
        <Grid container spacing={2}>
          {layers.map((layer) => {
            const layerData = quality[layer];
            if (!layerData) return null;

            const statusColors = getStatusColor(layerData.overall_status);
            const layerColor = layerColors[layer as keyof typeof layerColors];

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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: layerColor }}>
                      {layerNames[layer as keyof typeof layerNames]}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {getStatusIcon(layerData.overall_status)}
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          color: statusColors.bg,
                          fontSize: '1.1rem',
                        }}
                      >
                        {layerData.average_quality_score.toFixed(1)}%
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <LinearProgress
                      variant="determinate"
                      value={layerData.average_quality_score}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: `${statusColors.bg}20`,
                        '& .MuiLinearProgress-bar': {
                          background: `linear-gradient(90deg, ${statusColors.bg} 0%, ${statusColors.bg}80 100%)`,
                          borderRadius: 5,
                        },
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {layerData.tables.slice(0, 4).map((table) => {
                      const tableStatusColors = getStatusColor(table.status);
                      return (
                        <Box
                          key={table.table}
                          sx={{
                            p: 1,
                            borderRadius: 1.5,
                            backgroundColor: `${tableStatusColors.bg}10`,
                            border: `1px solid ${tableStatusColors.border}`,
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.75rem' }}>
                              {table.table}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {getStatusIcon(table.status)}
                              <Typography variant="caption" sx={{ fontWeight: 700, color: tableStatusColors.bg, fontSize: '0.75rem' }}>
                                {table.quality_score.toFixed(1)}%
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                              {table.row_count.toLocaleString()} rows
                            </Typography>
                            {table.dead_rows > 0 && (
                              <Typography variant="caption" sx={{ color: '#ef4444', fontSize: '0.7rem' }}>
                                {table.dead_rows.toLocaleString()} dead
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
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

