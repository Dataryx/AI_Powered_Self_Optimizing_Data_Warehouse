/**
 * Data Freshness Component
 * Displays data freshness indicators per layer with modern design
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Chip, Grid, Tooltip } from '@mui/material';
import { CheckCircle, Warning, Error as ErrorIcon, AccessTime } from '@mui/icons-material';
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

  useEffect(() => {
    fetchFreshness();
    const interval = setInterval(fetchFreshness, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [refreshKey]); // Re-run when refreshKey changes

  const fetchFreshness = async () => {
    try {
      const data = await apiService.getDataFreshness();
      setFreshness(data.freshness || {});
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data freshness:', err);
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading data freshness...</Typography>
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
          Data Freshness Indicators
        </Typography>

        <Grid container spacing={2}>
          {layers.map((layer) => {
            const layerData = freshness[layer];
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
                      <Chip
                        label={layerData.overall_status}
                        size="small"
                        sx={{
                          backgroundColor: statusColors.bg,
                          color: statusColors.color,
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          height: '22px',
                        }}
                      />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {layerData.tables.slice(0, 5).map((table) => {
                      const tableStatusColors = getStatusColor(table.status);
                      return (
                        <Tooltip
                          key={table.table}
                          title={
                            <Box>
                              <Typography variant="caption" sx={{ display: 'block' }}>
                                Last Updated: {table.last_updated ? new Date(table.last_updated).toLocaleString() : 'Never'}
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'block' }}>
                                Records: {table.total_records.toLocaleString()}
                              </Typography>
                            </Box>
                          }
                        >
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 1.5,
                              backgroundColor: `${tableStatusColors.color}10`,
                              border: `1px solid ${tableStatusColors.border}`,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'all 0.2s',
                              '&:hover': {
                                backgroundColor: `${tableStatusColors.color}20`,
                                transform: 'translateX(4px)',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                              {getStatusIcon(table.status)}
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                  color: 'text.primary',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {table.table}
                              </Typography>
                            </Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: tableStatusColors.color,
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                ml: 1,
                              }}
                            >
                              {table.hours_ago < 1
                                ? '<1h'
                                : table.hours_ago < 24
                                ? `${Math.round(table.hours_ago)}h`
                                : `${Math.round(table.hours_ago / 24)}d`}
                            </Typography>
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
      </CardContent>
    </Card>
  );
};

