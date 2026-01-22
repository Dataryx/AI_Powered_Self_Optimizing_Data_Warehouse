/**
 * Throughput Metrics Component
 * Displays throughput (records/second) with modern charts
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, Typography, Box, Grid, IconButton, Chip, LinearProgress } from '@mui/material';
import { Refresh, TrendingUp, Speed } from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { apiService } from '../../services/api';

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

export const ThroughputMetrics: React.FC<ThroughputMetricsProps> = ({ refreshKey = 0 }) => {
  const [throughput, setThroughput] = useState<ThroughputData[]>([]);
  const [overallThroughput, setOverallThroughput] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchThroughput = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getThroughputMetrics();
      console.log('Fetched throughput metrics:', data);
      setThroughput(data.throughput || []);
      setOverallThroughput(data.overall_throughput || 0);
      setLastFetch(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching throughput metrics:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch throughput metrics';
      setError(errorMessage);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThroughput();
    const interval = setInterval(fetchThroughput, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [refreshKey, fetchThroughput]);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#a855f7'];

  const chartData = throughput.slice(0, 10).map((item, index) => ({
    name: item.table.split('.').pop() || item.table,
    fullName: item.table,
    layer: item.layer,
    throughput: item.records_per_second,
    totalRecords: item.total_records,
    color: COLORS[index % COLORS.length],
  }));

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

  if (loading && throughput.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <LinearProgress sx={{ width: '100%', height: 6, borderRadius: 3 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 'fit-content' }}>
              Loading throughput metrics...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error && throughput.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ef4444', mb: 1 }}>
            Error Loading Throughput Metrics
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {error}
          </Typography>
          <IconButton onClick={fetchThroughput} sx={{ color: '#6366f1' }}>
            <Refresh /> Retry
          </IconButton>
        </CardContent>
      </Card>
    );
  }

  if (throughput.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Speed sx={{ color: '#64748b', fontSize: 48, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
            No Throughput Data Available
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Run ETL jobs to see throughput metrics
          </Typography>
        </CardContent>
      </Card>
    );
  }

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
              Throughput Metrics
            </Typography>
            {throughput.length > 0 && (
              <Chip
                icon={<TrendingUp sx={{ fontSize: 14 }} />}
                label={`${throughput.length} tables`}
                size="small"
                sx={{
                  backgroundColor: '#6366f120',
                  color: '#6366f1',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: '20px',
                }}
              />
            )}
            {lastFetch && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                Updated {formatTimeAgo(lastFetch)}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                px: 2,
                py: 1,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Speed sx={{ fontSize: 18 }} />
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', display: 'block', opacity: 0.9 }}>
                  Overall Throughput
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  {overallThroughput.toFixed(2)} rec/s
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={fetchThroughput} sx={{ color: '#6366f1' }}>
              <Refresh />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ width: '100%', height: 400, mb: 2 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 30, top: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} horizontal={false} />
              <XAxis
                type="number"
                stroke="#64748b"
                style={{ fontSize: '11px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value.toFixed(1)} rec/s`}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={120}
                stroke="#64748b"
                style={{ fontSize: '11px', fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                  padding: '12px',
                }}
                formatter={(value: number, name: string, props: any) => {
                  const data = props.payload;
                  return [
                    `${value.toFixed(2)} rec/s\nTable: ${data.fullName}\nRecords: ${data.totalRecords.toLocaleString()}\nLayer: ${data.layer}`,
                    'Throughput',
                  ];
                }}
                labelFormatter={() => ''}
                cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
              />
              <Bar dataKey="throughput" radius={[0, 8, 8, 0]} animationDuration={1000}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="throughput"
                  position="right"
                  formatter={(value: number) => `${value.toFixed(1)} rec/s`}
                  style={{ fontSize: '10px', fontWeight: 600, fill: '#64748b' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Grid container spacing={2}>
          {throughput.slice(0, 9).map((item, index) => {
            const color = COLORS[index % COLORS.length];
            const layerColors: { [key: string]: string } = {
              bronze: '#f59e0b',
              silver: '#6366f1',
              gold: '#10b981',
            };
            const layerColor = layerColors[item.layer] || color;
            
            return (
              <Grid item xs={12} sm={6} md={2} key={index}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    background: `linear-gradient(135deg, ${layerColor}10 0%, rgba(255,255,255,0.95) 100%)`,
                    border: `2px solid ${layerColor}30`,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: `linear-gradient(90deg, ${layerColor} 0%, ${layerColor}80 100%)`,
                    },
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: `0 8px 16px ${layerColor}40`,
                      borderColor: layerColor,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: 'text.primary',
                          fontSize: '0.7rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          mb: 0.5,
                        }}
                      >
                        {item.table.split('.').pop() || item.table}
                      </Typography>
                      <Chip
                        label={item.layer}
                        size="small"
                        sx={{
                          backgroundColor: `${layerColor}20`,
                          color: layerColor,
                          fontWeight: 600,
                          fontSize: '0.5rem',
                          height: '18px',
                          border: `1px solid ${layerColor}40`,
                        }}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ mt: 1.5 }}>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 800,
                        color: layerColor,
                        fontSize: '1.1rem',
                        mb: 0.25,
                      }}
                    >
                      {item.records_per_second.toFixed(2)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', fontWeight: 600 }}>
                      records/second
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                      {item.total_records.toLocaleString()} total records
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
};

