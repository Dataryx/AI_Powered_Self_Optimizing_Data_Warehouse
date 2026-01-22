/**
 * Storage Utilization Component
 * Enhanced with real-time updates and unique UI
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Grid, 
  IconButton, 
  Chip,
  CircularProgress,
  Tooltip,
  Pagination,
} from '@mui/material';
import { Refresh, Storage as StorageIcon, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { keyframes } from '@mui/material/styles';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { apiService } from '../../services/api';

interface TableUtilization {
  table: string;
  total_size: string;
  size_bytes: number;
  table_size: string;
  index_size: string;
  percentage: number;
  overall_percentage: number;
}

interface UtilizationData {
  [key: string]: {
    tables: TableUtilization[];
    total_size: string;
    total_bytes: number;
    table_count: number;
  };
}

const LAYER_COLORS = {
  bronze: '#f59e0b',
  silver: '#6366f1',
  gold: '#10b981',
};

// Slide animation for pagination
const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const slideOut = keyframes`
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(-20px);
  }
`;

const ITEMS_PER_PAGE = 5;

interface StorageUtilizationProps {
  refreshKey?: number;
}

export const StorageUtilization: React.FC<StorageUtilizationProps> = ({ refreshKey = 0 }) => {
  const [utilization, setUtilization] = useState<UtilizationData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [pageNumbers, setPageNumbers] = useState<{ [key: string]: number }>({
    bronze: 1,
    silver: 1,
    gold: 1,
  });
  const [animating, setAnimating] = useState<{ [key: string]: boolean }>({});

  const fetchUtilization = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getStorageUtilization();
      setUtilization(data.utilization || {});
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching storage utilization:', err);
      setError(err.message || 'Failed to fetch storage utilization');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUtilization();
    const interval = setInterval(fetchUtilization, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchUtilization, refreshKey]);

  if (loading && Object.keys(utilization).length === 0) {
    return (
      <Card 
        sx={{ 
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}
      >
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <CircularProgress size={40} sx={{ color: '#6366f1' }} />
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>
            Loading storage utilization...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if error and no data
  if (error && Object.keys(utilization).length === 0) {
    return (
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
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
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <StorageIcon sx={{ color: 'white', fontSize: 28 }} />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontSize: '1.25rem',
                  }}
                >
                  Storage Utilization
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  API unavailable
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Retry">
              <IconButton
                onClick={fetchUtilization}
                size="small"
                sx={{
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  color: '#6366f1',
                  '&:hover': {
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s',
                }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
              No data available
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 2 }}>
              Unable to connect to the API. Please check your connection.
            </Typography>
            <Chip
              label="Click refresh to retry"
              size="small"
              sx={{
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#6366f1',
                cursor: 'pointer',
              }}
              onClick={fetchUtilization}
            />
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Check if we have any data
  const hasData = Object.keys(utilization).length > 0 && 
    Object.entries(utilization)
      .filter(([key]) => key !== '_total')
      .some(([_, data]) => data && data.tables && data.tables.length > 0);

  // Prepare pie chart data
  const pieData = Object.entries(utilization)
    .filter(([key]) => key !== '_total')
    .map(([layer, data]) => ({
      name: layer.toUpperCase(),
      value: data?.total_bytes || 0,
      color: LAYER_COLORS[layer as keyof typeof LAYER_COLORS] || '#64748b',
    }))
    .filter(item => item.value > 0);

  // Prepare bar chart data (top tables)
  const allTables = Object.entries(utilization)
    .filter(([key]) => key !== '_total')
    .flatMap(([layer, data]) =>
      (data?.tables || []).map((table) => ({
        name: `${layer}.${table.table}`,
        layer,
        size: table.size_bytes || 0,
        percentage: table.overall_percentage || 0,
        color: LAYER_COLORS[layer as keyof typeof LAYER_COLORS] || '#64748b',
      }))
    )
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  const totalSize = utilization._total?.total_size || '0 MB';

  // Show empty state if no data
  if (!hasData && !loading && !error) {
    return (
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
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
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <StorageIcon sx={{ color: 'white', fontSize: 28 }} />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontSize: '1.25rem',
                  }}
                >
                  Storage Utilization
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  No data available
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Refresh">
              <IconButton
                onClick={fetchUtilization}
                size="small"
                sx={{
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  color: '#6366f1',
                  '&:hover': {
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s',
                }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
              No storage data available
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              Storage utilization data will appear here once available.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
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
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <StorageIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: '1.25rem',
                }}
              >
                Storage Utilization
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                Updated: {lastUpdate.toLocaleTimeString()}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={`Total: ${totalSize}`}
              sx={{
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#6366f1',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            />
            <Tooltip title="Refresh">
              <IconButton
                onClick={fetchUtilization}
                size="small"
                sx={{
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  color: '#6366f1',
                  '&:hover': {
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s',
                }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Pie Chart - By Layer */}
          <Grid item xs={12} md={4}>
            <Box 
              sx={{ 
                width: '100%', 
                height: 320,
                p: 2,
                borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(255,255,255,0.8) 100%)',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 2, textAlign: 'center', color: 'text.primary' }}>
                Distribution by Layer
              </Typography>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => {
                      const mb = value / (1024 * 1024);
                      return `${mb.toFixed(2)} MB`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          {/* Bar Chart - Top Tables */}
          <Grid item xs={12} md={8}>
            <Box 
              sx={{ 
                width: '100%', 
                height: 320,
                p: 2,
                borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(255,255,255,0.8) 100%)',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
                Top 10 Tables by Size
              </Typography>
              <ResponsiveContainer>
                <BarChart data={allTables} layout="vertical" margin={{ left: 120, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#64748b"
                    style={{ fontSize: '11px' }}
                    tickFormatter={(value) => `${(value / (1024 * 1024)).toFixed(0)} MB`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={110}
                    stroke="#64748b"
                    style={{ fontSize: '11px' }}
                  />
                  <RechartsTooltip
                    formatter={(value: number) => [`${(value / (1024 * 1024)).toFixed(2)} MB`, 'Size']}
                  />
                  <Bar dataKey="size" radius={[0, 10, 10, 0]} animationDuration={1000}>
                    {allTables.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          {/* Layer Breakdown */}
          {(['bronze', 'silver', 'gold'] as const).map((layer) => {
            const layerData = utilization[layer];
            if (!layerData) return null;

            const layerColor = LAYER_COLORS[layer];
            const allTables = layerData.tables || [];
            const currentPage = pageNumbers[layer] || 1;
            const totalPages = Math.ceil(allTables.length / ITEMS_PER_PAGE);
            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const currentTables = allTables.slice(startIndex, endIndex);

            const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
              setAnimating({ ...animating, [layer]: true });
              setTimeout(() => {
                setPageNumbers({ ...pageNumbers, [layer]: value });
                setTimeout(() => {
                  setAnimating({ ...animating, [layer]: false });
                }, 50);
              }, 200);
            };

            return (
              <Grid item xs={12} md={4} key={layer}>
                <Card
                  sx={{
                    p: 0.75,
                    background: `linear-gradient(135deg, ${layerColor}08 0%, rgba(255,255,255,0.95) 100%)`,
                    border: `1px solid ${layerColor}30`,
                    borderRadius: 1.5,
                    transition: 'all 0.3s',
                    height: '250px',
                    minHeight: '250px',
                    maxHeight: '250px',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: `0 4px 8px ${layerColor}25`,
                    },
                  }}
                >
                  <Box sx={{ mb: 0.75, flexShrink: 0 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: layerColor, mb: 0.25, fontSize: '0.7rem', display: 'block' }}>
                      {layer.toUpperCase()} Layer
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: layerColor, fontSize: '0.85rem' }}>
                        {layerData.total_size}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        {layerData.table_count} {layerData.table_count === 1 ? 'table' : 'tables'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 0.5,
                      flex: 1,
                      minHeight: 0,
                      position: 'relative',
                      pb: allTables.length > ITEMS_PER_PAGE ? 4 : 0,
                    }}
                  >
                    {allTables.length > 0 ? (
                      <Box
                        sx={{
                          animation: animating[layer] 
                            ? `${slideOut} 0.2s ease-out forwards` 
                            : `${slideIn} 0.3s ease-out forwards`,
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.5,
                          overflowY: 'auto',
                          maxHeight: allTables.length > ITEMS_PER_PAGE ? 'calc(100% - 30px)' : '100%',
                          pr: 0.25,
                          '&::-webkit-scrollbar': {
                            width: '3px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'rgba(0, 0, 0, 0.05)',
                            borderRadius: '2px',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: `${layerColor}60`,
                            borderRadius: '2px',
                            '&:hover': {
                              background: layerColor,
                            },
                          },
                        }}
                      >
                        {currentTables.map((table) => (
                          <Box
                            key={table.table}
                            sx={{
                              p: 0.5,
                              borderRadius: 0.75,
                              backgroundColor: 'rgba(255,255,255,0.7)',
                              border: `1px solid ${layerColor}20`,
                              transition: 'all 0.2s',
                              flexShrink: 0,
                              '&:hover': {
                                backgroundColor: 'rgba(255,255,255,0.9)',
                                borderColor: layerColor,
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  fontWeight: 600, 
                                  fontSize: '0.65rem', 
                                  flex: 1,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  mr: 0.5,
                                }}
                                title={table.table}
                              >
                                {table.table}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: layerColor, fontSize: '0.65rem', flexShrink: 0 }}>
                                {table.total_size}
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                height: 3,
                                borderRadius: 1.5,
                                backgroundColor: `${layerColor}20`,
                                position: 'relative',
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                sx={{
                                  height: '100%',
                                  width: `${table.percentage}%`,
                                  background: `linear-gradient(90deg, ${layerColor} 0%, ${layerColor}CC 100%)`,
                                  borderRadius: 1.5,
                                  transition: 'width 0.5s ease',
                                }}
                              />
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textAlign: 'center', py: 0.5 }}>
                        No tables in this layer
                      </Typography>
                    )}
                  </Box>

                  {allTables.length > ITEMS_PER_PAGE && (
                    <Box 
                      sx={{ 
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        pt: 0.75,
                        pb: 0.5,
                        borderTop: `1px solid ${layerColor}20`,
                        background: `linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, ${layerColor}08 100%)`,
                        backdropFilter: 'blur(4px)',
                        flexShrink: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        gap: 0.25,
                        px: 0.5,
                        zIndex: 2,
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handlePageChange({} as React.ChangeEvent<unknown>, Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        sx={{
                          p: 0.25,
                          minWidth: 'auto',
                          width: '18px',
                          height: '18px',
                          color: layerColor,
                          '&:disabled': {
                            opacity: 0.3,
                          },
                          '&:hover:not(:disabled)': {
                            backgroundColor: `${layerColor}15`,
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
                            color: layerColor,
                            '&.Mui-selected': {
                              backgroundColor: `${layerColor}20`,
                              color: layerColor,
                              fontWeight: 700,
                              '&:hover': {
                                backgroundColor: `${layerColor}30`,
                              },
                            },
                            '&:hover': {
                              backgroundColor: `${layerColor}15`,
                            },
                          },
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handlePageChange({} as React.ChangeEvent<unknown>, Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        sx={{
                          p: 0.25,
                          minWidth: 'auto',
                          width: '18px',
                          height: '18px',
                          color: layerColor,
                          '&:disabled': {
                            opacity: 0.3,
                          },
                          '&:hover:not(:disabled)': {
                            backgroundColor: `${layerColor}15`,
                          },
                        }}
                      >
                        <ChevronRight sx={{ fontSize: '12px' }} />
                      </IconButton>
                    </Box>
                  )}
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
};
