/**
 * Data Freshness & SLA Component
 * Dataset-centric freshness cards with SLA lag and upstream dependencies
 * Enterprise-grade minimal design
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, Typography, Box, Chip, Grid, Tooltip, IconButton, Paper, Divider, Button } from '@mui/material';
import { CheckCircle, Warning, Error as ErrorIcon, AccessTime, Refresh, ArrowUpward, Storage, TableChart, DataObject } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { useThemeColors } from '../../theme/useThemeColors';

interface TableFreshness {
  table: string;
  last_updated?: string;
  hours_ago: number;
  status: string;
  color: string;
  total_records: number;
}

interface FreshnessData {
  [key: string]: {
    tables: TableFreshness[];
    overall_status: string;
  };
}

interface DataFreshnessProps {
  refreshKey?: number;
}

export const DataFreshness: React.FC<DataFreshnessProps> = ({ refreshKey = 0 }) => {
  const colors = useThemeColors();
  const [freshness, setFreshness] = useState<FreshnessData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchFreshness = useCallback(async () => {
    try {
      setError(null);
      const data = (await apiService.getDataFreshness()) as { freshness?: FreshnessData };
      console.log('Fetched data freshness:', data);
      setFreshness(data.freshness || {});
      setLastFetch(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data freshness:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data freshness';
      setError(errorMessage);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFreshness();
    const interval = setInterval(fetchFreshness, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [refreshKey, fetchFreshness]); // Re-run when refreshKey changes

  // Debug logging
  useEffect(() => {
    console.log('DataFreshness state:', { 
      loading, 
      layers: Object.keys(freshness),
      totalTables: Object.values(freshness).reduce((sum, layer) => sum + (layer.tables?.length || 0), 0),
      error,
      refreshKey 
    });
  }, [loading, freshness, error, refreshKey]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fresh':
        return <CheckCircle sx={{ color: colors.success, fontSize: 20 }} />;
      case 'stale':
        return <Warning sx={{ color: colors.warning, fontSize: 20 }} />;
      case 'outdated':
        return <ErrorIcon sx={{ color: colors.error, fontSize: 20 }} />;
      default:
        return <AccessTime sx={{ color: colors.textSecondary, fontSize: 20 }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fresh':
        return { bg: `${colors.success}20`, color: colors.success, border: `${colors.success}40` };
      case 'stale':
        return { bg: `${colors.warning}20`, color: colors.warning, border: `${colors.warning}40` };
      case 'outdated':
        return { bg: `${colors.error}20`, color: colors.error, border: `${colors.error}40` };
      default:
        return { bg: `${colors.textSecondary}20`, color: colors.textSecondary, border: `${colors.textSecondary}40` };
    }
  };

  const layers = ['bronze', 'silver', 'gold'];
  const layerNames = { bronze: 'Bronze Layer', silver: 'Silver Layer', gold: 'Gold Layer' };
  const layerColors = { bronze: colors.warning, silver: colors.accent, gold: colors.success };
  const getLayerIcon = (layer: string) => {
    switch (layer) {
      case 'bronze':
        return <Storage sx={{ fontSize: 16, color: colors.warning }} />;
      case 'silver':
        return <TableChart sx={{ fontSize: 16, color: colors.primary }} />;
      case 'gold':
        return <DataObject sx={{ fontSize: 16, color: colors.success }} />;
      default:
        return <Storage sx={{ fontSize: 16, color: colors.textSecondary }} />;
    }
  };

  const formatTimeAgo = (hoursAgo: number): string => {
    if (hoursAgo < 1) {
      const minutes = Math.round(hoursAgo * 60);
      return minutes < 1 ? 'Just now' : `${minutes}m ago`;
    } else if (hoursAgo < 24) {
      return `${Math.round(hoursAgo)}h ago`;
    } else {
      const days = Math.round(hoursAgo / 24);
      return `${days}d ago`;
    }
  };

  const getTotalTables = (): number => {
    return Object.values(freshness).reduce((sum, layer) => sum + (layer.tables?.length || 0), 0);
  };

  if (loading && Object.keys(freshness).length === 0) {
    return (
      <Card sx={{ background: `linear-gradient(135deg, ${colors.paper} 0%, ${colors.background} 100%)` }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading data freshness...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error && Object.keys(freshness).length === 0) {
    return (
      <Card sx={{ background: `linear-gradient(135deg, ${colors.paper} 0%, ${colors.background} 100%)`, border: `1px solid ${colors.error}30` }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <ErrorIcon sx={{ color: colors.error, fontSize: 48, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: colors.error, mb: 1 }}>
            Error Loading Data Freshness
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {error}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const totalTables = getTotalTables();

  if (loading && totalTables === 0) {
    return (
      <Card elevation={0} sx={{ bgcolor: colors.paper, border: `1px solid ${colors.border}`, borderRadius: 2 }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.875rem' }}>
            Loading freshness data...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (error && totalTables === 0) {
    return (
      <Card sx={{ background: `linear-gradient(135deg, ${colors.paper} 0%, ${colors.background} 100%)`, border: `1px solid ${colors.error}30` }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <ErrorIcon sx={{ color: colors.error, fontSize: 48, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: colors.error, mb: 1 }}>
            Error Loading Data Freshness
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {error}
          </Typography>
          <IconButton onClick={fetchFreshness} sx={{ color: 'colors.success' }}>
            <Refresh /> Retry
          </IconButton>
        </CardContent>
      </Card>
    );
  }

  // Calculate SLA status
  const getSLAStatus = (hoursAgo: number) => {
    if (hoursAgo < 1) return { status: 'on-time', label: 'On time', color: colors.success };
    if (hoursAgo < 24) return { status: 'at-risk', label: 'At risk', color: colors.warning };
    return { status: 'breach', label: 'SLA breach', color: colors.error };
  };

  // Get all tables across layers for dataset-centric view
  const allTables = layers.flatMap((layer) => {
    const layerData = freshness[layer];
    if (!layerData?.tables) return [];
    return layerData.tables.map((table) => ({
      ...table,
      layer,
      layerName: layerNames[layer as keyof typeof layerNames],
    }));
  });

  const onTimeCount = allTables.filter((t) => getSLAStatus(t.hours_ago).status === 'on-time').length;
  const atRiskCount = allTables.filter((t) => getSLAStatus(t.hours_ago).status === 'at-risk').length;
  const breachCount = allTables.filter((t) => getSLAStatus(t.hours_ago).status === 'breach').length;

  return (
    <Card elevation={0} sx={{ bgcolor: colors.paper, border: `1px solid ${colors.border}`, borderRadius: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: colors.text,
                fontSize: '1rem',
                mb: 0.5,
              }}
            >
              Data Freshness & SLA
            </Typography>
            <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
              Dataset freshness with SLA compliance
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={fetchFreshness}
            sx={{
              color: colors.primary,
              '&:hover': { backgroundColor: '#f1f5f9' },
            }}
          >
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* SLA Summary */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: colors.background, border: `1px solid ${colors.border}`, borderRadius: 1.5, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                On Time
              </Typography>
              <Typography variant="h6" sx={{ color: colors.success, fontSize: '1.25rem', fontWeight: 600 }}>
                {onTimeCount}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: colors.border }} />
            <Box>
              <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                At Risk
              </Typography>
              <Typography variant="h6" sx={{ color: colors.warning, fontSize: '1.25rem', fontWeight: 600 }}>
                {atRiskCount}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: colors.border }} />
            <Box>
              <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                SLA Breach
              </Typography>
              <Typography variant="h6" sx={{ color: colors.error, fontSize: '1.25rem', fontWeight: 600 }}>
                {breachCount}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: colors.border }} />
            <Box>
              <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                Total Datasets
              </Typography>
              <Typography variant="h6" sx={{ color: colors.text, fontSize: '1.25rem', fontWeight: 600 }}>
                {allTables.length}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {allTables.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <AccessTime sx={{ fontSize: 40, color: colors.textMuted, mb: 1.5 }} />
            <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.875rem' }}>
              No freshness data available
            </Typography>
          </Box>
        ) : (
          <>
            <Grid container spacing={2}>
              {allTables.slice(0, 6).map((table, index) => {
                const slaStatus = getSLAStatus(table.hours_ago);
                const tableStatusColors = getStatusColor(table.status);
                const layerColor = layerColors[table.layer as keyof typeof layerColors];

                return (
                  <Grid item xs={12} sm={6} md={4} key={`${table.layer}-${table.table}-${index}`}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        bgcolor: colors.paper,
                        border: `1px solid ${slaStatus.color}30`,
                        borderRadius: 1.5,
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                        '&:hover': {
                          borderColor: slaStatus.color,
                          boxShadow: `0 2px 8px ${slaStatus.color}20`,
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                            {getLayerIcon(table.layer)}
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: colors.text,
                                fontSize: '0.875rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                              }}
                            >
                              {table.table}
                            </Typography>
                          </Box>
                        </Box>
                        {getStatusIcon(table.status)}
                      </Box>

                      <Divider sx={{ my: 1.5, borderColor: colors.border }} />

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.75rem', minWidth: '80px' }}>
                            SLA Lag
                          </Typography>
                          <Chip
                            label={slaStatus.label}
                            size="small"
                            sx={{
                              backgroundColor: slaStatus.color + '15',
                              color: slaStatus.color,
                              fontWeight: 600,
                              fontSize: '0.6875rem',
                              height: '20px',
                              border: `1px solid ${slaStatus.color}30`,
                            }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.75rem', minWidth: '80px' }}>
                            Last Updated
                          </Typography>
                          <Typography variant="caption" sx={{ color: colors.text, fontSize: '0.75rem', fontWeight: 500 }}>
                            {formatTimeAgo(table.hours_ago)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.75rem', minWidth: '80px' }}>
                            Records
                          </Typography>
                          <Typography variant="caption" sx={{ color: colors.text, fontSize: '0.75rem', fontWeight: 500 }}>
                            {table.total_records.toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
            {allTables.length > 6 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{
                    color: colors.primary,
                    borderColor: colors.primary,
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    textTransform: 'none',
                    px: 3,
                    '&:hover': {
                      borderColor: colors.primary,
                      backgroundColor: `${colors.primary}15`,
                    },
                  }}
                >
                  View all ({allTables.length} datasets)
                </Button>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

