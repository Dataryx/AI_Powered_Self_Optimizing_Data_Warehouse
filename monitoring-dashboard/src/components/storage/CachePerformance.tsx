/**
 * Cache Performance Component
 * Enhanced with real-time updates
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Grid, 
  Chip,
  IconButton,
  Tooltip,
  Pagination,
} from '@mui/material';
import { Refresh, CheckCircle, Warning, Error as ErrorIcon, Speed, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { keyframes } from '@mui/material/styles';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
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

interface CachePerformanceProps {
  refreshKey?: number;
}

// Slide animation for pagination
const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const slideOut = keyframes`
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
`;

const ITEMS_PER_PAGE = 4;

export const CachePerformance: React.FC<CachePerformanceProps> = ({ refreshKey = 0 }) => {
  const [cache, setCache] = useState<CacheData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);

  const fetchCache = useCallback(async () => {
    try {
      const data = await apiService.getCachePerformance();
      setCache(data);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching cache performance:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCache();
    const interval = setInterval(fetchCache, 30000);
    return () => clearInterval(interval);
  }, [fetchCache, refreshKey]);

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

  if (loading && !cache) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading cache performance...</Typography>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no cache data
  if (!cache) {
    return (
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
          },
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Speed sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Box>
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
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  API unavailable
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Refresh">
              <IconButton
                onClick={fetchCache}
                size="small"
                sx={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  '&:hover': {
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s',
                }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No cache performance data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Show all tables in chart (top 8 for display)
  const chartData = cache.tables.slice(0, 8).map((table) => ({
    name: table.table.split('.').pop() || table.table,
    hitRate: table.hit_rate,
    color: table.hit_rate >= 95 ? '#10b981' : table.hit_rate >= 85 ? '#3b82f6' : table.hit_rate >= 70 ? '#f59e0b' : '#ef4444',
  }));

  // Pagination for table details
  const totalPages = Math.ceil(cache.tables.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentTables = cache.tables.slice(startIndex, endIndex);

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentPage(value);
      setTimeout(() => {
        setIsAnimating(false);
      }, 50);
    }, 200);
  };

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
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        maxHeight: '600px',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
        },
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1,
                background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Speed sx={{ color: 'white', fontSize: 16 }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: '0.85rem',
                  lineHeight: 1.2,
                  mb: 0.25,
                }}
              >
                Cache Performance
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                Updated: {lastUpdate.toLocaleTimeString()}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.5,
                borderRadius: 1.5,
                backgroundColor: overallStatus.light,
                border: `1px solid ${overallStatus.border}`,
              }}
            >
              <OverallIcon sx={{ color: overallStatus.bg, fontSize: 14 }} />
              <Box>
                <Typography variant="caption" sx={{ color: overallStatus.bg, fontWeight: 600, display: 'block', fontSize: '0.6rem' }}>
                  Overall Hit Rate
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: overallStatus.bg, fontSize: '0.8rem' }}>
                  {cache.overall.hit_rate.toFixed(1)}%
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Refresh">
              <IconButton
                onClick={fetchCache}
                size="small"
                sx={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  width: '28px',
                  height: '28px',
                  '&:hover': {
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s',
                }}
              >
                <Refresh sx={{ fontSize: '14px' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Overall Stats */}
          <Grid item xs={12} md={4}>
            <Box sx={{ width: '100%', height: 220, p: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, textAlign: 'center', fontSize: '0.85rem' }}>
                Cache Hits vs Disk Reads
              </Typography>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value, percent }) => `${name}\n${value.toLocaleString()}\n${(percent * 100).toFixed(1)}%`}
                    outerRadius={65}
                    fill="#8884d8"
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString()} (${((value / (pieData[0].value + pieData[1].value)) * 100).toFixed(1)}%)`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          {/* Top Tables Chart */}
          <Grid item xs={12} md={8}>
            <Box sx={{ width: '100%', height: 220, p: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.85rem' }}>
                Top 8 Tables by Hit Rate
              </Typography>
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, left: 90, right: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    stroke="#64748b"
                    style={{ fontSize: '10px' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={85}
                    stroke="#64748b"
                    style={{ fontSize: '10px' }}
                  />
                  <RechartsTooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Hit Rate']} />
                  <Bar dataKey="hitRate" radius={[0, 8, 8, 0]} animationDuration={1000}>
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
        <Box
          sx={{
            animation: isAnimating 
              ? `${slideOut} 0.2s ease-out forwards` 
              : `${slideIn} 0.3s ease-out forwards`,
          }}
        >
          <Grid container spacing={1} sx={{ mb: cache.tables.length > ITEMS_PER_PAGE ? 1 : 0 }}>
            {currentTables.map((table, index) => {
              const statusColors = getStatusColor(table.status);
              const StatusIcon = statusColors.icon;

              return (
                <Grid item xs={12} sm={6} key={`${table.table}-${startIndex + index}`}>
                  <Card
                    sx={{
                      p: 0.75,
                      background: `linear-gradient(135deg, ${statusColors.light} 0%, rgba(255,255,255,0.9) 100%)`,
                      border: `1px solid ${statusColors.border}`,
                      borderRadius: 1.25,
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: `0 4px 8px ${statusColors.border}`,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color: 'text.primary',
                            fontSize: '0.65rem',
                            mb: 0.4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={table.table}
                        >
                          {table.table.split('.').pop() || table.table}
                        </Typography>
                        <Chip
                          label={table.status}
                          size="small"
                          sx={{
                            backgroundColor: statusColors.light,
                            color: statusColors.bg,
                            fontWeight: 600,
                            fontSize: '0.55rem',
                            height: '16px',
                            '& .MuiChip-label': {
                              padding: '0 6px',
                            },
                          }}
                        />
                      </Box>
                      <StatusIcon sx={{ color: statusColors.bg, fontSize: 14 }} />
                    </Box>

                    <Box sx={{ mb: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                          Hit Rate
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: statusColors.bg, fontSize: '0.7rem' }}>
                          {table.hit_rate.toFixed(1)}%
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          height: 3,
                          borderRadius: 1.5,
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
                            borderRadius: 1.5,
                            transition: 'width 0.3s',
                          }}
                        />
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.75 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.55rem' }}>
                          Hits
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#10b981', fontSize: '0.65rem' }}>
                          {table.cache_hits.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.55rem' }}>
                          Disk Reads
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#ef4444', fontSize: '0.65rem' }}>
                          {table.disk_reads.toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        {/* Pagination */}
        {cache.tables.length > ITEMS_PER_PAGE && (
          <Box 
            sx={{ 
              mt: 1.5,
              pt: 0.75,
              borderTop: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: 0.25,
              px: 0.5,
            }}
          >
            <IconButton
              size="small"
              onClick={() => handlePageChange({} as React.ChangeEvent<unknown>, Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isAnimating}
              sx={{
                p: 0.25,
                minWidth: 'auto',
                width: '18px',
                height: '18px',
                color: '#10b981',
                '&:disabled': {
                  opacity: 0.3,
                },
                '&:hover:not(:disabled)': {
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                },
              }}
            >
              <ChevronLeft sx={{ fontSize: '12px' }} />
            </IconButton>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              size="small"
              siblingCount={0}
              boundaryCount={1}
              hidePrevButton
              hideNextButton
              sx={{
                '& .MuiPagination-ul': {
                  flexWrap: 'nowrap',
                  gap: 0.25,
                  justifyContent: 'center',
                },
                '& .MuiPaginationItem-root': {
                  minWidth: '18px',
                  height: '18px',
                  fontSize: '0.6rem',
                  padding: 0,
                  margin: 0,
                  color: '#10b981',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    fontWeight: 700,
                    '&:hover': {
                      backgroundColor: 'rgba(16, 185, 129, 0.3)',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  },
                },
              }}
            />
            <IconButton
              size="small"
              onClick={() => handlePageChange({} as React.ChangeEvent<unknown>, Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || isAnimating}
              sx={{
                p: 0.25,
                minWidth: 'auto',
                width: '18px',
                height: '18px',
                color: '#10b981',
                '&:disabled': {
                  opacity: 0.3,
                },
                '&:hover:not(:disabled)': {
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                },
              }}
            >
              <ChevronRight sx={{ fontSize: '12px' }} />
            </IconButton>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
