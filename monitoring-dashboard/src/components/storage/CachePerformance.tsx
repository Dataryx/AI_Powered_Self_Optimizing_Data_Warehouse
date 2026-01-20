/**
 * Cache Performance Component
 * Displays cache hit/miss rates and performance metrics
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Grid, Chip } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { CheckCircle, Warning, Error as ErrorIcon } from '@mui/icons-material';
import { apiService } from '../../services/api';

interface CacheTable {
  table: string;
  schema: string;
  cache_hits: number;
  disk_reads: number;
  hit_rate: number;
  status: string;
}

interface CacheData {
  tables: CacheTable[];
  overall: {
    cache_hits: number;
    disk_reads: number;
    hit_rate: number;
    status: string;
  };
}

export const CachePerformance: React.FC = () => {
  const [cache, setCache] = useState<CacheData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCache();
    const interval = setInterval(fetchCache, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCache = async () => {
    try {
      const data = await apiService.getCachePerformance();
      setCache(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching cache performance:', err);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return { bg: '#10b981', light: '#10b98120', border: '#10b98140', icon: CheckCircle };
      case 'good':
        return { bg: '#3b82f6', light: '#3b82f620', border: '#3b82f640', icon: CheckCircle };
      case 'fair':
        return { bg: '#f59e0b', light: '#f59e0b20', border: '#f59e0b40', icon: Warning };
      case 'poor':
        return { bg: '#ef4444', light: '#ef444420', border: '#ef444440', icon: ErrorIcon };
      default:
        return { bg: '#64748b', light: '#64748b20', border: '#64748b40', icon: Warning };
    }
  };

  if (loading || !cache) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading cache performance...</Typography>
        </CardContent>
      </Card>
    );
  }

  const chartData = cache.tables.slice(0, 10).map((table, index) => ({
    name: table.table,
    hitRate: table.hit_rate,
    color: table.hit_rate >= 95 ? '#10b981' : table.hit_rate >= 85 ? '#3b82f6' : table.hit_rate >= 70 ? '#f59e0b' : '#ef4444',
  }));

  const overallStatus = getStatusColor(cache.overall.status);
  const OverallIcon = overallStatus.icon;

  // Pie chart data for overall hits vs misses
  const pieData = [
    { name: 'Cache Hits', value: cache.overall.cache_hits, color: '#10b981' },
    { name: 'Disk Reads', value: cache.overall.disk_reads, color: '#ef4444' },
  ];

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
            Cache Performance
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.5,
              borderRadius: 2,
              backgroundColor: overallStatus.light,
              border: `1px solid ${overallStatus.border}`,
            }}
          >
            <OverallIcon sx={{ color: overallStatus.bg, fontSize: 20 }} />
            <Box>
              <Typography variant="caption" sx={{ color: overallStatus.bg, fontWeight: 600, display: 'block', fontSize: '0.7rem' }}>
                Overall Hit Rate
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: overallStatus.bg, fontSize: '0.9rem' }}>
                {cache.overall.hit_rate.toFixed(1)}%
              </Typography>
            </Box>
          </Box>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Overall Stats */}
          <Grid item xs={12} md={4}>
            <Box sx={{ width: '100%', height: 250 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, textAlign: 'center' }}>
                Cache Hits vs Disk Reads
              </Typography>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          {/* Top Tables Chart */}
          <Grid item xs={12} md={8}>
            <Box sx={{ width: '100%', height: 250 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Top 10 Tables by Hit Rate
              </Typography>
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    stroke="#64748b"
                    style={{ fontSize: '11px' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    stroke="#64748b"
                    style={{ fontSize: '11px' }}
                  />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Hit Rate']} />
                  <Bar dataKey="hitRate" radius={[0, 10, 10, 0]} animationDuration={1000}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
        </Grid>

        {/* Table Details */}
        <Grid container spacing={2}>
          {cache.tables.slice(0, 6).map((table, index) => {
            const statusColors = getStatusColor(table.status);
            const StatusIcon = statusColors.icon;

            return (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card
                  sx={{
                    p: 2,
                    background: `linear-gradient(135deg, ${statusColors.light} 0%, rgba(255,255,255,0.9) 100%)`,
                    border: `2px solid ${statusColors.border}`,
                    borderRadius: 2,
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 8px 16px ${statusColors.border}`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: 'text.primary',
                          fontSize: '0.85rem',
                          mb: 0.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {table.table}
                      </Typography>
                      <Chip
                        label={table.status}
                        size="small"
                        sx={{
                          backgroundColor: statusColors.light,
                          color: statusColors.bg,
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          height: '18px',
                        }}
                      />
                    </Box>
                    <StatusIcon sx={{ color: statusColors.bg, fontSize: 24 }} />
                  </Box>

                  <Box sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        Hit Rate
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: statusColors.bg, fontSize: '0.95rem' }}>
                        {table.hit_rate.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: `${statusColors.bg}20`,
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: `${table.hit_rate}%`,
                          background: `linear-gradient(90deg, ${statusColors.bg} 0%, ${statusColors.bg}80 100%)`,
                          borderRadius: 4,
                          transition: 'width 0.3s',
                        }}
                      />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem' }}>
                        Hits
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#10b981', fontSize: '0.85rem' }}>
                        {table.cache_hits.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem' }}>
                        Disk Reads
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#ef4444', fontSize: '0.85rem' }}>
                        {table.disk_reads.toLocaleString()}
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

