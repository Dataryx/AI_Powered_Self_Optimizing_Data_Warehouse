/**
 * Index Recommendations Component
 * Displays ML-generated index optimization recommendations
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
  Button,
  LinearProgress,
  Pagination,
  Grid,
} from '@mui/material';
import { Refresh, Storage, TrendingUp, CheckCircle, Warning, Error as ErrorIcon, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { keyframes } from '@mui/material/styles';
import { apiService } from '../../services/api';

interface Recommendation {
  recommendation_id: string;
  type: string;
  table: string;
  columns: string[];
  estimated_improvement: number;
  cost: number;
  priority: string;
  status: string;
  created_at: string;
  query_count?: number;
  avg_execution_time_ms?: number;
  sql_statement?: string;
}

interface IndexRecommendationsProps {
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

const ITEMS_PER_PAGE = 5;

export const IndexRecommendations: React.FC<IndexRecommendationsProps> = ({ refreshKey = 0 }) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async () => {
    try {
      const data = await apiService.getOptimizationRecommendations('index', 'pending');
      setRecommendations(data.recommendations || []);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching index recommendations:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
    const interval = setInterval(fetchRecommendations, 30000);
    return () => clearInterval(interval);
  }, [fetchRecommendations, refreshKey]);

  const handleApply = async (recommendationId: string) => {
    setApplying(recommendationId);
    try {
      await apiService.applyOptimization(recommendationId, false);
      await fetchRecommendations();
    } catch (err) {
      console.error('Error applying recommendation:', err);
    } finally {
      setApplying(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return { bg: '#ef4444', light: '#ef444420', border: '#ef444440', icon: ErrorIcon };
      case 'medium':
        return { bg: '#f59e0b', light: '#f59e0b20', border: '#f59e0b40', icon: Warning };
      case 'low':
        return { bg: '#3b82f6', light: '#3b82f620', border: '#3b82f640', icon: CheckCircle };
      default:
        return { bg: '#64748b', light: '#64748b20', border: '#64748b40', icon: Warning };
    }
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentPage(value);
      setIsAnimating(false);
    }, 150);
  };

  const totalPages = Math.ceil(recommendations.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentRecommendations = recommendations.slice(startIndex, endIndex);

  if (loading && recommendations.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading index recommendations...</Typography>
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
          background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
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
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Storage sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                Index Recommendations
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                ML-generated optimization suggestions
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={recommendations.length}
              size="small"
              sx={{
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#6366f1',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
            <IconButton
              onClick={fetchRecommendations}
              size="small"
              sx={{
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#6366f1',
                '&:hover': {
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
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

        {/* Recommendations List */}
        {recommendations.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No index recommendations available
            </Typography>
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
                  background: 'rgba(99, 102, 241, 0.3)',
                  borderRadius: '3px',
                  '&:hover': {
                    background: 'rgba(99, 102, 241, 0.5)',
                  },
                },
              }}
            >
              {currentRecommendations.map((rec, index) => {
                const priorityColors = getPriorityColor(rec.priority);
                const PriorityIcon = priorityColors.icon;
                const improvementPercent = (rec.estimated_improvement * 100).toFixed(1);

                return (
                  <Box
                    key={rec.recommendation_id}
                    sx={{
                      p: 1.25,
                      mb: 1,
                      borderRadius: 1.5,
                      border: `1px solid ${priorityColors.border}`,
                      background: priorityColors.light,
                      animation: isAnimating
                        ? `${slideOut} 0.15s ease-out`
                        : `${slideIn} 0.3s ease-out`,
                      animationDelay: `${index * 0.05}s`,
                      '&:hover': {
                        background: priorityColors.light.replace('20', '30'),
                        transform: 'translateX(4px)',
                      },
                      transition: 'all 0.2s',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                          <PriorityIcon sx={{ fontSize: 14, color: priorityColors.bg }} />
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                            {rec.table}
                          </Typography>
                          <Chip
                            label={rec.priority}
                            size="small"
                            sx={{
                              height: '16px',
                              fontSize: '0.65rem',
                              backgroundColor: priorityColors.bg,
                              color: 'white',
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', ml: 2.25 }}>
                          Columns: {rec.columns.join(', ')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title={`${improvementPercent}% improvement expected`}>
                          <Chip
                            icon={<TrendingUp sx={{ fontSize: 12 }} />}
                            label={`+${improvementPercent}%`}
                            size="small"
                            sx={{
                              height: '18px',
                              fontSize: '0.65rem',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              color: '#10b981',
                              fontWeight: 600,
                            }}
                          />
                        </Tooltip>
                      </Box>
                    </Box>

                    {rec.query_count && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, ml: 2.25 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                          Based on {rec.query_count} queries
                        </Typography>
                        {rec.avg_execution_time_ms && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                            • Avg: {rec.avg_execution_time_ms.toFixed(2)}ms
                          </Typography>
                        )}
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.75 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', ml: 2.25 }}>
                        {new Date(rec.created_at).toLocaleDateString()}
                      </Typography>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleApply(rec.recommendation_id)}
                        disabled={applying === rec.recommendation_id}
                        sx={{
                          backgroundColor: '#6366f1',
                          color: 'white',
                          fontSize: '0.7rem',
                          px: 1.5,
                          py: 0.25,
                          minWidth: 'auto',
                          height: '24px',
                          '&:hover': {
                            backgroundColor: '#4f46e5',
                          },
                        }}
                      >
                        {applying === rec.recommendation_id ? 'Applying...' : 'Apply'}
                      </Button>
                    </Box>
                  </Box>
                );
              })}
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
                  borderTop: '1px solid rgba(99, 102, 241, 0.1)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={handlePageChange}
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
                            color: item.selected ? 'white' : '#6366f1',
                            backgroundColor: item.selected ? '#6366f1' : 'transparent',
                            '&:hover': {
                              backgroundColor: item.selected ? '#4f46e5' : 'rgba(99, 102, 241, 0.1)',
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

