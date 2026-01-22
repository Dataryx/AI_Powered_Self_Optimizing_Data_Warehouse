/**
 * Optimization History Component
 * Displays optimization application history
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip,
  IconButton,
  Tooltip,
  Pagination,
} from '@mui/material';
import { Refresh, History, CheckCircle, Error as ErrorIcon, Schedule, FiberManualRecord } from '@mui/icons-material';
import { keyframes } from '@mui/material/styles';
import { apiService } from '../../services/api';

interface HistoryItem {
  recommendation_id: string;
  type: string;
  table: string;
  columns: string[];
  priority: string;
  created_at: string;
  query_count?: number;
  avg_execution_time_ms?: number;
  sql_statement?: string;
}

interface OptimizationHistoryProps {
  refreshKey?: number;
}

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const ITEMS_PER_PAGE = 8;

export const OptimizationHistory: React.FC<OptimizationHistoryProps> = ({ refreshKey = 0 }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(1);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiService.getOptimizationHistory(100);
      setHistory(data.history || []);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching optimization history:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [fetchHistory, refreshKey]);

  const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentHistory = history.slice(startIndex, endIndex);

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'index':
        return '#6366f1';
      case 'partition':
        return '#8b5cf6';
      case 'cache':
        return '#ec4899';
      default:
        return '#64748b';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#3b82f6';
      default:
        return '#64748b';
    }
  };

  if (loading && history.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading optimization history...</Typography>
        </CardContent>
      </Card>
    );
  }

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
        maxHeight: '600px',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 50%, #6366f1 100%)',
        },
      }}
    >
      <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <History sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                Optimization History
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                Applied optimizations timeline
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={history.length}
              size="small"
              sx={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
            <IconButton
              onClick={fetchHistory}
              size="small"
              sx={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                '&:hover': {
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  transform: 'rotate(180deg)',
                },
                transition: 'all 0.3s',
                width: 28,
                height: 28,
              }}
            >
              <Refresh sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </Box>

        {/* History Timeline */}
        {history.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box>
              <Schedule sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No optimization history available
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                pb: 0.5,
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'rgba(0, 0, 0, 0.05)',
                  borderRadius: '3px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(16, 185, 129, 0.3)',
                  borderRadius: '3px',
                  '&:hover': {
                    background: 'rgba(16, 185, 129, 0.5)',
                  },
                },
              }}
            >
              <Box sx={{ position: 'relative', pl: 2 }}>
                {/* Timeline line */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 6,
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    background: 'linear-gradient(to bottom, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.1))',
                  }}
                />
                {currentHistory.map((item, index) => {
                  const typeColor = getTypeColor(item.type);
                  const priorityColor = getPriorityColor(item.priority);

                  return (
                    <Box
                      key={item.recommendation_id}
                      sx={{
                        position: 'relative',
                        mb: 2,
                        animation: `${slideIn} 0.3s ease-out`,
                        animationDelay: `${index * 0.05}s`,
                      }}
                    >
                      {/* Timeline dot */}
                      <Box
                        sx={{
                          position: 'absolute',
                          left: -18,
                          top: 8,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: typeColor,
                          border: `2px solid white`,
                          boxShadow: `0 0 0 2px ${typeColor}`,
                          zIndex: 1,
                        }}
                      />
                      {/* Content */}
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          border: `1px solid ${typeColor}40`,
                          background: `${typeColor}10`,
                          ml: 0.5,
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                              {item.table}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                              {item.type} • {item.columns.join(', ')}
                            </Typography>
                          </Box>
                          <Chip
                            label={item.priority}
                            size="small"
                            sx={{
                              height: '16px',
                              fontSize: '0.65rem',
                              backgroundColor: priorityColor,
                              color: 'white',
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                          {new Date(item.created_at).toLocaleString()}
                          {item.query_count && ` • ${item.query_count} queries`}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Pagination */}
            {totalPages > 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  p: 1,
                  background: 'linear-gradient(to top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.8) 100%)',
                  backdropFilter: 'blur(10px)',
                  borderTop: '1px solid rgba(16, 185, 129, 0.1)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(e, value) => setCurrentPage(value)}
                  size="small"
                  siblingCount={0}
                  boundaryCount={1}
                  renderItem={(item) => (
                    <Box
                      sx={{
                        ...(item.type === 'page' && {
                          '& .MuiPaginationItem-root': {
                            minWidth: '28px',
                            height: '28px',
                            fontSize: '0.75rem',
                            color: item.selected ? 'white' : '#10b981',
                            backgroundColor: item.selected ? '#10b981' : 'transparent',
                            '&:hover': {
                              backgroundColor: item.selected ? '#059669' : 'rgba(16, 185, 129, 0.1)',
                            },
                          },
                        }),
                      }}
                      {...item}
                    />
                  )}
                />
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

