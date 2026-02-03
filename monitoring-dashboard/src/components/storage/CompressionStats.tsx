/**
 * Compression Statistics Component
 * Enhanced with real-time updates
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  LinearProgress,
  IconButton,
  Tooltip,
  Chip,
  Link,
} from '@mui/material';
import { Refresh, Compress, ChevronLeft, ChevronRight } from '@mui/icons-material';
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
} from 'recharts';
import { apiService } from '../../services/api';

interface TableCompression {
  table: string;
  total_size: string;
  table_size: string;
  row_count: number;
  compression_ratio: number;
  compression_percentage: number;
}

interface CompressionData {
  [key: string]: {
    tables: TableCompression[];
    average_compression_ratio: number;
  };
}

interface CompressionStatsProps {
  refreshKey?: number;
}

// Slide animations
const slideInRight = keyframes`
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const slideInLeft = keyframes`
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const slideOutRight = keyframes`
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(-30px);
  }
`;

const slideOutLeft = keyframes`
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(30px);
  }
`;

export const CompressionStats: React.FC<CompressionStatsProps> = ({ refreshKey = 0 }) => {
  const [compression, setCompression] = useState<CompressionData>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentLayerIndex, setCurrentLayerIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [isAnimating, setIsAnimating] = useState(false);
  const [showAllTables, setShowAllTables] = useState(false);

  const fetchCompression = useCallback(async () => {
    try {
      const data = await apiService.getCompressionStats();
      setCompression(data.compression || {});
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching compression stats:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompression();
    const interval = setInterval(fetchCompression, 120000);
    return () => clearInterval(interval);
  }, [fetchCompression, refreshKey]);

  if (loading && Object.keys(compression).length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading compression statistics...</Typography>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no compression data
  const hasData = Object.keys(compression).length > 0 && 
    Object.values(compression).some(layer => layer && layer.tables && layer.tables.length > 0);
  
  if (!hasData && !loading) {
    return (
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
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
            background: 'linear-gradient(90deg, #f59e0b 0%, #6366f1 50%, #10b981 100%)',
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
                <Compress sx={{ color: 'white', fontSize: 24 }} />
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
                    fontSize: '1.1rem',
                  }}
                >
                  Compression Statistics
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  API unavailable
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Refresh">
              <IconButton
                onClick={fetchCompression}
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
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No compression data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const layers = ['bronze', 'silver', 'gold'] as const;
  const layerNames = { bronze: 'Bronze Layer', silver: 'Silver Layer', gold: 'Gold Layer' };
  const layerColors = { bronze: '#f59e0b', silver: '#6366f1', gold: '#10b981' };

  // Get available layers (layers that have data)
  const availableLayers = layers.filter((layer) => compression[layer]);
  
  // Get current layer for detail box
  const currentLayer = availableLayers[currentLayerIndex] || availableLayers[0];
  const currentLayerData = currentLayer ? compression[currentLayer] : null;

  // Prepare chart data for all layers
  const chartData = availableLayers.map((layer) => ({
    layer: layer.toUpperCase(),
    ratio: compression[layer].average_compression_ratio,
    color: layerColors[layer],
  }));

  const handleLayerChange = (newIndex: number) => {
    if (newIndex === currentLayerIndex || isAnimating || newIndex < 0 || newIndex >= availableLayers.length) return;
    
    const direction = newIndex > currentLayerIndex ? 'right' : 'left';
    setSlideDirection(direction);
    setIsAnimating(true);
    setShowAllTables(false); // Reset show all when changing layers
    
    setTimeout(() => {
      setCurrentLayerIndex(newIndex);
      setTimeout(() => {
        setIsAnimating(false);
      }, 50);
    }, 200);
  };

  const handleNext = () => {
    if (currentLayerIndex < availableLayers.length - 1) {
      handleLayerChange(currentLayerIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentLayerIndex > 0) {
      handleLayerChange(currentLayerIndex - 1);
    }
  };

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
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
          background: 'linear-gradient(90deg, #f59e0b 0%, #6366f1 50%, #10b981 100%)',
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
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Compress sx={{ color: 'white', fontSize: 16 }} />
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
                  fontSize: '0.85rem',
                  lineHeight: 1.2,
                  mb: 0.25,
                }}
              >
                Compression Statistics
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                Updated: {lastUpdate.toLocaleTimeString()}
              </Typography>
            </Box>
          </Box>
          <Tooltip title="Refresh">
            <IconButton
              onClick={fetchCompression}
              size="small"
              sx={{
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#6366f1',
                width: '28px',
                height: '28px',
                '&:hover': {
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  transform: 'rotate(180deg)',
                },
                transition: 'all 0.3s',
              }}
            >
              <Refresh sx={{ fontSize: '14px' }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Compression Ratio Chart - All layers */}
        {chartData.length > 0 && (
          <Box 
            sx={{ 
              width: '100%', 
              height: 120, 
              mb: 1.5,
              p: 0.75,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(255,255,255,0.5) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.1)',
            }}
          >
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis
                  dataKey="layer"
                  stroke="#64748b"
                  style={{ fontSize: '9px', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  style={{ fontSize: '9px', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: 6,
                    fontSize: '10px',
                    padding: '4px 8px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}x`, 'Compression Ratio']}
                />
                <Bar dataKey="ratio" radius={[4, 4, 0, 0]} animationDuration={1000} barSize={32}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Layer Navigation */}
        {availableLayers.length > 1 && (
          <Box 
            sx={{ 
              mb: 1.5, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 0.75,
            }}
          >
            <IconButton
              size="small"
              onClick={handlePrevious}
              disabled={currentLayerIndex === 0 || isAnimating}
              sx={{
                p: 0.25,
                minWidth: 'auto',
                width: '24px',
                height: '24px',
                color: layerColors[currentLayer] || '#6366f1',
                '&:disabled': {
                  opacity: 0.3,
                },
                '&:hover:not(:disabled)': {
                  backgroundColor: `${layerColors[currentLayer] || '#6366f1'}15`,
                },
              }}
            >
              <ChevronLeft sx={{ fontSize: '14px' }} />
            </IconButton>
            
            <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'center' }}>
              {availableLayers.map((layer, index) => (
                <Chip
                  key={layer}
                  label={layer.toUpperCase()}
                  onClick={() => handleLayerChange(index)}
                  size="small"
                  sx={{
                    backgroundColor: index === currentLayerIndex 
                      ? `${layerColors[layer]}20` 
                      : 'rgba(0, 0, 0, 0.05)',
                    color: index === currentLayerIndex 
                      ? layerColors[layer] 
                      : 'text.secondary',
                    fontWeight: index === currentLayerIndex ? 700 : 500,
                    fontSize: '0.65rem',
                    height: '22px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    border: index === currentLayerIndex 
                      ? `1px solid ${layerColors[layer]}40` 
                      : '1px solid transparent',
                    '&:hover': {
                      backgroundColor: `${layerColors[layer]}15`,
                      color: layerColors[layer],
                    },
                  }}
                />
              ))}
            </Box>

            <IconButton
              size="small"
              onClick={handleNext}
              disabled={currentLayerIndex === availableLayers.length - 1 || isAnimating}
              sx={{
                p: 0.25,
                minWidth: 'auto',
                width: '24px',
                height: '24px',
                color: layerColors[currentLayer] || '#6366f1',
                '&:disabled': {
                  opacity: 0.3,
                },
                '&:hover:not(:disabled)': {
                  backgroundColor: `${layerColors[currentLayer] || '#6366f1'}15`,
                },
              }}
            >
              <ChevronRight sx={{ fontSize: '14px' }} />
            </IconButton>
          </Box>
        )}

        {/* Layer Details - Show one at a time with slide animation */}
        {currentLayerData && (
          <Box
            sx={{
              position: 'relative',
              minHeight: '200px',
              height: '400px',
              overflow: 'hidden',
            }}
          >
            <Box
              key={currentLayer}
              sx={{
                height: '100%',
                animation: isAnimating
                  ? (slideDirection === 'right' 
                      ? `${slideOutLeft} 0.2s ease-out forwards` 
                      : `${slideOutRight} 0.2s ease-out forwards`)
                  : (slideDirection === 'right'
                      ? `${slideInRight} 0.3s ease-out forwards`
                      : `${slideInLeft} 0.3s ease-out forwards`),
              }}
            >
              <Card
                sx={{
                  p: 1.5,
                  background: `linear-gradient(135deg, ${layerColors[currentLayer]}08 0%, rgba(255,255,255,0.9) 100%)`,
                  border: `1.5px solid ${layerColors[currentLayer]}30`,
                  borderRadius: 1.5,
                  boxShadow: `0 2px 8px ${layerColors[currentLayer]}15`,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ mb: 1.5, pb: 1, borderBottom: `1px solid ${layerColors[currentLayer]}20`, flexShrink: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: layerColors[currentLayer], mb: 0.75, fontSize: '0.8rem' }}>
                    {layerNames[currentLayer]}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                      Avg Compression:
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: layerColors[currentLayer], fontSize: '0.95rem' }}>
                      {currentLayerData.average_compression_ratio.toFixed(2)}x
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', mt: 0.5, display: 'block' }}>
                    {currentLayerData.tables.length} {currentLayerData.tables.length === 1 ? 'table' : 'tables'}
                  </Typography>
                </Box>

                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 0.75,
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pr: 0.5,
                    pb: 0.5,
                    '&::-webkit-scrollbar': {
                      width: '4px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'rgba(0, 0, 0, 0.05)',
                      borderRadius: '2px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: `${layerColors[currentLayer]}60`,
                      borderRadius: '2px',
                      '&:hover': {
                        background: layerColors[currentLayer],
                      },
                    },
                  }}
                >
                  {currentLayerData.tables.length > 0 ? (
                    <>
                      {/* Sort tables by compression ratio and show top 3 or all */}
                      {currentLayerData.tables
                        .sort((a, b) => b.compression_ratio - a.compression_ratio)
                        .slice(0, showAllTables ? currentLayerData.tables.length : 3)
                        .map((table) => {
                          const compressionPercent = table.compression_percentage;
                          return (
                            <Box
                              key={table.table}
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                backgroundColor: 'rgba(255,255,255,0.7)',
                                border: `1px solid ${layerColors[currentLayer]}15`,
                                transition: 'all 0.2s',
                                flexShrink: 0,
                                '&:hover': {
                                  backgroundColor: 'rgba(255,255,255,0.9)',
                                  borderColor: layerColors[currentLayer],
                                  transform: 'translateX(2px)',
                                },
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    fontWeight: 600, 
                                    fontSize: '0.65rem', 
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={table.table}
                                >
                                  {table.table}
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: layerColors[currentLayer], fontSize: '0.65rem', ml: 0.75, flexShrink: 0 }}>
                                  {table.compression_ratio.toFixed(2)}x
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(compressionPercent, 100)}
                                  sx={{
                                    flex: 1,
                                    height: 2.5,
                                    borderRadius: 1.25,
                                    backgroundColor: `${layerColors[currentLayer]}20`,
                                    '& .MuiLinearProgress-bar': {
                                      background: `linear-gradient(90deg, ${layerColors[currentLayer]} 0%, ${layerColors[currentLayer]}80 100%)`,
                                      borderRadius: 1.25,
                                    },
                                  }}
                                />
                                <Typography variant="caption" sx={{ fontWeight: 600, color: layerColors[currentLayer], fontSize: '0.6rem', minWidth: '32px', textAlign: 'right', flexShrink: 0 }}>
                                  {compressionPercent.toFixed(1)}%
                                </Typography>
                              </Box>
                            </Box>
                          );
                        })}
                      {/* View all tables link if more than 3 */}
                      {currentLayerData.tables.length > 3 && (
                        <Box sx={{ pt: 0.5, textAlign: 'center' }}>
                          <Link
                            component="button"
                            variant="caption"
                            onClick={() => {
                              setShowAllTables(!showAllTables);
                            }}
                            sx={{
                              color: layerColors[currentLayer],
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              cursor: 'pointer',
                              '&:hover': {
                                textDecoration: 'underline',
                              },
                            }}
                          >
                            {showAllTables 
                              ? `Show less (top 3)` 
                              : `View all ${currentLayerData.tables.length} tables`}
                          </Link>
                        </Box>
                      )}
                    </>
                  ) : (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textAlign: 'center', py: 2 }}>
                      No tables in this layer
                    </Typography>
                  )}
                </Box>
              </Card>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
