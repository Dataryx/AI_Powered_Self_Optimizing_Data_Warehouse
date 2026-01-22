/**
 * Data Quality Metrics Component
 * Displays data quality metrics per pipeline stage
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, Typography, Box, Grid, LinearProgress, IconButton, Chip, Tooltip } from '@mui/material';
import { CheckCircle, Warning, Error as ErrorIcon, Refresh, TrendingUp, Assessment } from '@mui/icons-material';
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
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchQuality = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getDataQualityMetrics();
      console.log('Fetched data quality metrics:', data);
      setQuality(data.quality_metrics || {});
      setLastFetch(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data quality metrics:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data quality metrics';
      setError(errorMessage);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuality();
    const interval = setInterval(fetchQuality, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [refreshKey, fetchQuality]);

  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getTotalTables = (): number => {
    return Object.values(quality).reduce((sum, layer) => sum + (layer.tables?.length || 0), 0);
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

  const totalTables = getTotalTables();

  if (loading && totalTables === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <LinearProgress sx={{ width: '100%', height: 6, borderRadius: 3 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 'fit-content' }}>
              Loading quality metrics...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error && totalTables === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <ErrorIcon sx={{ color: '#ef4444', fontSize: 48, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ef4444', mb: 1 }}>
            Error Loading Quality Metrics
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {error}
          </Typography>
          <IconButton onClick={fetchQuality} sx={{ color: '#10b981' }}>
            <Refresh /> Retry
          </IconButton>
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

  if (totalTables === 0 && !loading) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <CheckCircle sx={{ color: '#64748b', fontSize: 48, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
            No Quality Data Available
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Run ETL jobs to see data quality metrics
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(16, 185, 129, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: '0.95rem',
                whiteSpace: 'nowrap',
              }}
            >
              Data Quality Metrics
            </Typography>
            {totalTables > 0 && (
              <Chip
                icon={<TrendingUp sx={{ fontSize: 12 }} />}
                label={totalTables}
                size="small"
                sx={{
                  backgroundColor: '#10b98120',
                  color: '#10b981',
                  fontWeight: 600,
                  fontSize: '0.65rem',
                  height: '18px',
                  whiteSpace: 'nowrap',
                }}
              />
            )}
            {lastFetch && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary', 
                  fontSize: '0.65rem',
                  whiteSpace: 'nowrap',
                  ml: 'auto',
                  display: { xs: 'none', sm: 'block' },
                }}
              >
                {formatTimeAgo(lastFetch)}
              </Typography>
            )}
          </Box>
          <IconButton 
            size="small" 
            onClick={fetchQuality} 
            sx={{ 
              color: '#10b981',
              ml: 1,
              padding: '4px',
              '&:hover': {
                backgroundColor: '#10b98110',
              },
            }}
          >
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Overall Quality Chart */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ width: '100%', height: 140 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 5, right: 15, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis
                    dataKey="layer"
                    stroke="#64748b"
                    style={{ fontSize: '10px', fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748b"
                    style={{ fontSize: '10px', fontWeight: 500 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                    width={35}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.98)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: 8,
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                      padding: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(2)}%`, 'Quality Score']}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} animationDuration={1000}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>

          {/* Layer Quality Details */}
          <Grid container spacing={1} sx={{ flex: 1, minHeight: 0 }}>
          {layers.map((layer) => {
            const layerData = quality[layer];
            if (!layerData) {
              // Show placeholder for missing layer data
              return (
                <Box key={layer} sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                    {layer.toUpperCase()} Layer: No data available
                  </Typography>
                </Box>
              );
            }

            const statusColors = getStatusColor(layerData.overall_status);
            const layerColor = layerColors[layer as keyof typeof layerColors];

            return (
              <Grid item xs={12} sm={6} md={4} key={layer}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    p: 1.25,
                    background: `linear-gradient(135deg, ${layerColor}08 0%, rgba(255,255,255,0.95) 100%)`,
                    border: `1.5px solid ${layerColor}30`,
                    borderRadius: 2,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: `linear-gradient(90deg, ${layerColor} 0%, ${layerColor}80 100%)`,
                    },
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 6px 12px ${layerColor}40`,
                      borderColor: layerColor,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: layerColor, fontSize: '0.8rem' }}>
                      {layerNames[layer as keyof typeof layerNames]}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {getStatusIcon(layerData.overall_status)}
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          color: statusColors.bg,
                          fontSize: '0.9rem',
                        }}
                      >
                        {layerData.average_quality_score.toFixed(1)}%
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mb: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={layerData.average_quality_score}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: `${statusColors.bg}20`,
                        '& .MuiLinearProgress-bar': {
                          background: `linear-gradient(90deg, ${statusColors.bg} 0%, ${statusColors.bg}80 100%)`,
                          borderRadius: 3,
                        },
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1, overflowY: 'auto' }}>
                    {layerData.tables.slice(0, 5).map((table) => {
                      const tableStatusColors = getStatusColor(table.status);
                      return (
                        <Box
                          key={table.table}
                          sx={{
                            p: 1,
                            borderRadius: 1.25,
                            backgroundColor: `${tableStatusColors.bg}10`,
                            border: `1px solid ${tableStatusColors.border}`,
                            transition: 'all 0.2s',
                            '&:hover': {
                              backgroundColor: `${tableStatusColors.bg}20`,
                              transform: 'translateX(2px)',
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontWeight: 600, 
                                color: 'text.primary', 
                                fontSize: '0.7rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              {table.table}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
                              {getStatusIcon(table.status)}
                              <Typography variant="caption" sx={{ fontWeight: 700, color: tableStatusColors.bg, fontSize: '0.65rem' }}>
                                {table.quality_score.toFixed(1)}%
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                              {table.row_count.toLocaleString()} rows
                            </Typography>
                            {table.dead_rows > 0 && (
                              <Typography variant="caption" sx={{ color: '#ef4444', fontSize: '0.6rem' }}>
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
        </Box>
      </CardContent>
    </Card>
  );
};

