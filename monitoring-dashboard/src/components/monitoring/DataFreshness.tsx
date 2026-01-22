/**
 * Data Freshness Component
 * Displays data freshness indicators per layer with modern design
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, Typography, Box, Chip, Grid, Tooltip, IconButton, LinearProgress } from '@mui/material';
import { CheckCircle, Warning, Error as ErrorIcon, AccessTime, Refresh, FiberManualRecord } from '@mui/icons-material';
import { apiService } from '../../services/api';

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
  const [freshness, setFreshness] = useState<FreshnessData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchFreshness = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getDataFreshness();
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
        return <CheckCircle sx={{ color: '#10b981', fontSize: 20 }} />;
      case 'stale':
        return <Warning sx={{ color: '#f59e0b', fontSize: 20 }} />;
      case 'outdated':
        return <ErrorIcon sx={{ color: '#ef4444', fontSize: 20 }} />;
      default:
        return <AccessTime sx={{ color: '#64748b', fontSize: 20 }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fresh':
        return { bg: '#10b98120', color: '#10b981', border: '#10b98140' };
      case 'stale':
        return { bg: '#f59e0b20', color: '#f59e0b', border: '#f59e0b40' };
      case 'outdated':
        return { bg: '#ef444420', color: '#ef4444', border: '#ef444440' };
      default:
        return { bg: '#64748b20', color: '#64748b', border: '#64748b40' };
    }
  };

  const layers = ['bronze', 'silver', 'gold'];
  const layerNames = { bronze: 'Bronze Layer', silver: 'Silver Layer', gold: 'Gold Layer' };
  const layerColors = { bronze: '#f59e0b', silver: '#6366f1', gold: '#10b981' };
  const layerIcons = { bronze: '🟤', silver: '🔵', gold: '🟢' };

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
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading data freshness...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error && Object.keys(freshness).length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <ErrorIcon sx={{ color: '#ef4444', fontSize: 48, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ef4444', mb: 1 }}>
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
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <LinearProgress sx={{ width: '100%', height: 6, borderRadius: 3 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 'fit-content' }}>
              Loading freshness data...
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
            Error Loading Data Freshness
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {error}
          </Typography>
          <IconButton onClick={fetchFreshness} sx={{ color: '#10b981' }}>
            <Refresh /> Retry
          </IconButton>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(16, 185, 129, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: '1.1rem',
              }}
            >
              Data Freshness Indicators
            </Typography>
            {totalTables > 0 && (
              <Chip
                label={`${totalTables} tables`}
                size="small"
                sx={{
                  backgroundColor: '#10b98120',
                  color: '#10b981',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: '20px',
                }}
              />
            )}
            {lastFetch && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                Updated {formatTimeAgo((Date.now() - lastFetch.getTime()) / (1000 * 60 * 60))}
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={fetchFreshness} sx={{ color: '#10b981' }}>
            <Refresh />
          </IconButton>
        </Box>

        {totalTables === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AccessTime sx={{ color: '#64748b', fontSize: 48, mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
              No Freshness Data Available
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Run ETL jobs to see data freshness indicators
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {layers.map((layer) => {
              const layerData = freshness[layer];
              // Show placeholder for missing layer data instead of returning null
              if (!layerData || !layerData.tables || layerData.tables.length === 0) {
                return (
                  <Box key={layer} sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                      {layer.toUpperCase()} Layer: No tables available
                    </Typography>
                  </Box>
                );
              }

              const statusColors = getStatusColor(layerData.overall_status);
              const layerColor = layerColors[layer as keyof typeof layerColors];
              const layerTableCount = layerData.tables.length;

              return (
                <Grid item xs={12} md={4} key={layer}>
                  <Card
                    sx={{
                      p: 2.5,
                      background: `linear-gradient(135deg, ${layerColor}08 0%, rgba(255,255,255,0.95) 100%)`,
                      border: `2px solid ${layerColor}30`,
                      borderRadius: 2.5,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: `linear-gradient(90deg, ${layerColor} 0%, ${layerColor}80 100%)`,
                      },
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: `0 12px 24px ${layerColor}40`,
                        borderColor: layerColor,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${layerColor} 0%, ${layerColor}80 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '1.2rem',
                          }}
                        >
                          {layerIcons[layer as keyof typeof layerIcons]}
                        </Box>
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: layerColor, fontSize: '0.95rem' }}>
                            {layerNames[layer as keyof typeof layerNames]}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                            {layerTableCount} {layerTableCount === 1 ? 'table' : 'tables'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getStatusIcon(layerData.overall_status)}
                        <Chip
                          label={layerData.overall_status}
                          size="small"
                          sx={{
                            backgroundColor: statusColors.bg,
                            color: statusColors.color,
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            height: '22px',
                            border: `1px solid ${statusColors.border}`,
                          }}
                        />
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {layerData.tables.slice(0, 6).map((table) => {
                        const tableStatusColors = getStatusColor(table.status);
                        return (
                          <Tooltip
                            key={table.table}
                            title={
                              <Box sx={{ p: 0.5 }}>
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
                                  {table.table}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                                  Last Updated: {table.last_updated ? new Date(table.last_updated).toLocaleString() : 'Never'}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                                  Records: {table.total_records.toLocaleString()}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', opacity: 0.9 }}>
                                  Age: {formatTimeAgo(table.hours_ago)}
                                </Typography>
                              </Box>
                            }
                            arrow
                          >
                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                background: `linear-gradient(135deg, ${tableStatusColors.color}08 0%, ${tableStatusColors.color}05 100%)`,
                                border: `1.5px solid ${tableStatusColors.border}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer',
                                position: 'relative',
                                '&:hover': {
                                  backgroundColor: `${tableStatusColors.color}15`,
                                  transform: 'translateX(6px)',
                                  borderColor: tableStatusColors.color,
                                  boxShadow: `0 4px 12px ${tableStatusColors.color}30`,
                                },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: 24,
                                  }}
                                >
                                  {getStatusIcon(table.status)}
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: '0.85rem',
                                      color: 'text.primary',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      mb: 0.25,
                                    }}
                                  >
                                    {table.table}
                                  </Typography>
                                  {table.total_records > 0 && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <FiberManualRecord sx={{ fontSize: 6, color: tableStatusColors.color }} />
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: 'text.secondary',
                                          fontSize: '0.7rem',
                                          fontWeight: 500,
                                        }}
                                      >
                                        {table.total_records.toLocaleString()} records
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              </Box>
                              <Box
                                sx={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-end',
                                  gap: 0.25,
                                  ml: 1,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: tableStatusColors.color,
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {formatTimeAgo(table.hours_ago)}
                                </Typography>
                                <Chip
                                  label={table.status}
                                  size="small"
                                  sx={{
                                    backgroundColor: tableStatusColors.bg,
                                    color: tableStatusColors.color,
                                    fontWeight: 600,
                                    fontSize: '0.65rem',
                                    height: '18px',
                                    border: `1px solid ${tableStatusColors.border}`,
                                  }}
                                />
                              </Box>
                            </Box>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};

