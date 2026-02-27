/**
 * Throughput Metrics – user-friendly view: hero metric + table list with layer badges.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  LinearProgress,
  Chip,
} from '@mui/material';
import { Refresh, Speed, TableChart } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { useThemeColors } from '../../theme/useThemeColors';

interface ThroughputData {
  table: string;
  layer: string;
  records_per_second: number;
  total_records: number;
  total_operations: number;
  duration_seconds?: number;
}

interface ThroughputMetricsProps {
  refreshKey?: number;
}

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

export const ThroughputMetrics: React.FC<ThroughputMetricsProps> = ({ refreshKey = 0 }) => {
  const colors = useThemeColors();
  const layerColors: Record<string, { bg: string; text: string }> = {
    bronze: { bg: colors.layerBronze.bg, text: colors.layerBronze.text },
    silver: { bg: colors.layerSilver.bg, text: colors.layerSilver.text },
    gold: { bg: colors.layerGold.bg, text: colors.layerGold.text },
  };
  const [throughput, setThroughput] = useState<ThroughputData[]>([]);
  const [overallThroughput, setOverallThroughput] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchThroughput = useCallback(async () => {
    try {
      setError(null);
      const data = (await apiService.getThroughputMetrics()) as any;
      setThroughput(data.throughput || []);
      setOverallThroughput(data.overall_throughput || 0);
      setLastFetch(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching throughput metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch throughput metrics');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThroughput();
    const interval = setInterval(fetchThroughput, 15000);
    return () => clearInterval(interval);
  }, [refreshKey, fetchThroughput]);

  const topTables = throughput
    .slice()
    .sort((a, b) => b.records_per_second - a.records_per_second)
    .slice(0, 10);
  const maxRecPerSec = Math.max(...topTables.map((t) => t.records_per_second), 1);

  if (loading && throughput.length === 0) {
    return (
      <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <LinearProgress sx={{ flex: 1, height: 6, borderRadius: 3 }} />
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Loading throughput...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error && throughput.length === 0) {
    return (
      <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ color: '#dc2626', mb: 1 }}>
            {error}
          </Typography>
          <IconButton onClick={fetchThroughput} size="small">
            <Refresh /> Retry
          </IconButton>
        </CardContent>
      </Card>
    );
  }

  if (throughput.length === 0) {
    return (
      <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Speed sx={{ color: '#94a3b8', fontSize: 40, mb: 1 }} />
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            No throughput data. Run ETL jobs to see metrics.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ border: `1px solid ${colors.border}`, borderRadius: 2, overflow: 'hidden', bgcolor: colors.paper }}>
      <CardContent sx={{ p: 0 }}>
        {/* Hero: total throughput */}
        <Box
          sx={{
            p: 2.5,
            background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.paper} 100%)`,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="overline" sx={{ color: colors.primary, fontWeight: 600, letterSpacing: 0.5 }}>
                Total throughput
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.25 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: colors.primaryDark }}>
                  {overallThroughput.toFixed(1)}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  records / sec
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', mt: 0.5 }}>
                How fast we're processing data across all tables
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                Updated {formatTimeAgo(lastFetch)}
              </Typography>
              <IconButton size="small" onClick={fetchThroughput} aria-label="Refresh" sx={{ color: colors.primary }}>
                <Refresh fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Table list */}
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
            <TableChart sx={{ fontSize: 18, color: colors.textSecondary }} />
            <Typography variant="subtitle2" sx={{ color: colors.textMuted, fontWeight: 600 }}>
              Top tables by speed
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {topTables.map((row) => {
              const layerStyle = layerColors[row.layer] || { bg: colors.accentLight, text: colors.textMuted };
              const pct = (row.records_per_second / maxRecPerSec) * 100;
              const shortName = row.table.split('.').pop() || row.table;
              return (
                <Box
                  key={row.table}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 0.75,
                    px: 1.25,
                    borderRadius: 1.5,
                    '&:hover': { backgroundColor: colors.background },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        color: colors.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={row.table}
                    >
                      {shortName}
                    </Typography>
                    <Chip
                      size="small"
                      label={row.layer}
                      sx={{
                        mt: 0.25,
                        height: 20,
                        fontSize: '0.7rem',
                        backgroundColor: layerStyle.bg,
                        color: layerStyle.text,
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', minWidth: 56, textAlign: 'right' }}>
                    {row.records_per_second.toFixed(1)} rec/s
                  </Typography>
                  <Box sx={{ width: 80 }}>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.borderLight,
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          backgroundColor: colors.primary,
                        },
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};
