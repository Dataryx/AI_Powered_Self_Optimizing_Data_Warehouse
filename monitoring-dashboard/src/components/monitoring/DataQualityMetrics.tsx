/**
 * Data Quality Component
 * One card per layer (Bronze, Silver, Gold)
 * Overall quality score and top failing rules
 * Enterprise-grade minimal design
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, Typography, Box, Grid, IconButton, Chip, Paper, Divider } from '@mui/material';
import { CheckCircle, Warning, Error as ErrorIcon, Refresh } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { useThemeColors } from '../../theme/useThemeColors';

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
  const colors = useThemeColors();
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

  const getStatusColor = (status: string, score?: number) => {
    // Use muted amber for low scores instead of red
    if (score !== undefined && score < 20) {
      return { bg: '#d97706', light: '#d9770620', border: '#d9770640', text: '#92400e' };
    }
    switch (status) {
      case 'excellent':
        return { bg: '#10b981', light: '#10b98120', border: '#10b98140', text: '#065f46' };
      case 'good':
        return { bg: '#3b82f6', light: '#3b82f620', border: '#3b82f640', text: '#1e40af' };
      case 'fair':
        return { bg: '#f59e0b', light: '#f59e0b20', border: '#f59e0b40', text: '#92400e' };
      case 'poor':
        return { bg: '#d97706', light: '#d9770620', border: '#d9770640', text: '#92400e' }; // Muted amber instead of red
      default:
        return { bg: '#64748b', light: '#64748b20', border: '#64748b40', text: '#334155' };
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
      <Card elevation={0} sx={{ bgcolor: colors.paper, border: `1px solid ${colors.border}`, borderRadius: 2 }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.875rem' }}>
            Loading quality metrics...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (error && totalTables === 0) {
    return (
      <Card elevation={0} sx={{ bgcolor: colors.paper, border: `1px solid ${colors.border}`, borderRadius: 2 }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <ErrorIcon sx={{ color: '#ef4444', fontSize: 40, mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#0f172a', mb: 0.5, fontSize: '1rem' }}>
            Error Loading Quality Metrics
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2, fontSize: '0.875rem' }}>
            {error}
          </Typography>
          <IconButton onClick={fetchQuality} sx={{ color: '#6366f1', '&:hover': { backgroundColor: '#f1f5f9' } }}>
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
          <CheckCircle sx={{ color: colors.textSecondary, fontSize: 48, mb: 2 }} />
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

  // Get top failing rules per layer
  const getTopFailingRules = (layerData: { tables: TableQuality[] }) => {
    const rules: { name: string; count: number }[] = [];
    layerData.tables.forEach((table) => {
      if (table.dead_rows > 0) {
        const existing = rules.find((r) => r.name === 'Dead rows');
        if (existing) existing.count += table.dead_rows;
        else rules.push({ name: 'Dead rows', count: table.dead_rows });
      }
      if (table.quality_score < 80) {
        const existing = rules.find((r) => r.name === 'Low quality score');
        if (existing) existing.count += 1;
        else rules.push({ name: 'Low quality score', count: 1 });
      }
    });
    return rules.sort((a, b) => b.count - a.count).slice(0, 3);
  };

  return (
    <Card elevation={0} sx={{ bgcolor: colors.paper, border: `1px solid ${colors.border}`, borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: '#0f172a',
              fontSize: '1rem',
            }}
          >
            Data Quality
          </Typography>
          <IconButton
            size="small"
            onClick={fetchQuality}
            sx={{
              color: '#6366f1',
              '&:hover': { backgroundColor: '#f1f5f9' },
            }}
          >
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {totalTables === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircle sx={{ fontSize: 40, color: '#94a3b8', mb: 1.5 }} />
            <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.875rem' }}>
              No quality data available
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {layers.map((layer) => {
              const layerData = quality[layer];
              if (!layerData) return null;

              const statusColors = getStatusColor(layerData.overall_status, layerData.average_quality_score);
              const layerColor = layerColors[layer as keyof typeof layerColors];
              const topFailingRules = getTopFailingRules(layerData);

              return (
                <Grid item xs={12} key={layer}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      bgcolor: colors.paper,
                      border: `1px solid ${layerColor}30`,
                      borderRadius: 1.5,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: layerColor,
                        boxShadow: `0 2px 8px ${layerColor}20`,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1,
                            background: layerColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                          }}
                        >
                          {layer.charAt(0).toUpperCase()}
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem', mb: 0.25 }}>
                            {layerNames[layer as keyof typeof layerNames]}
                          </Typography>
                          <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
                            {layerData.tables.length} datasets
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                        {getStatusIcon(layerData.overall_status)}
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            color: statusColors.text || statusColors.bg,
                            fontSize: '1.25rem',
                            lineHeight: 1,
                          }}
                        >
                          {layerData.average_quality_score.toFixed(1)}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: statusColors.text || statusColors.bg,
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            opacity: 0.8,
                          }}
                        >
                          %
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2, borderColor: '#e2e8f0' }} />

                    {/* Top Failing Rules */}
                    <Box>
                      <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', mb: 1.5 }}>
                        Top Failing Rules
                      </Typography>
                      {topFailingRules.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {topFailingRules.map((rule, index) => (
                            <Box
                              key={index}
                              sx={{
                                p: 1.5,
                                borderRadius: 1,
                                background: index === 0 ? `${colors.warningLight}80` : colors.background,
                                border: `1px solid ${index === 0 ? '#fde68a' : '#e2e8f0'}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: '#0f172a', 
                                  fontSize: index === 0 ? '0.875rem' : '0.8125rem', 
                                  fontWeight: index === 0 ? 600 : 500,
                                }}
                              >
                                {rule.name}
                              </Typography>
                              <Chip
                                label={rule.count}
                                size="small"
                                sx={{
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                  fontWeight: 500,
                                  fontSize: '0.6875rem',
                                  height: '20px',
                                  border: '1px solid #fde68a',
                                }}
                              />
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Box sx={{ textAlign: 'center', py: 2 }}>
                          <CheckCircle sx={{ fontSize: 24, color: '#10b981', mb: 1 }} />
                          <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
                            No failing rules detected
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};

