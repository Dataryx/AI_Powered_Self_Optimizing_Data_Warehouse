/**
 * Partition Recommendations Component
 * Displays partition optimization recommendations
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
} from '@mui/material';
import { Refresh, TableChart, TrendingUp, CheckCircle, Warning } from '@mui/icons-material';
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
}

interface PartitionRecommendationsProps {
  refreshKey?: number;
}

export const PartitionRecommendations: React.FC<PartitionRecommendationsProps> = ({ refreshKey = 0 }) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchRecommendations = useCallback(async () => {
    try {
      const data = await apiService.getOptimizationRecommendations('partition', 'pending');
      setRecommendations(data.recommendations || []);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching partition recommendations:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
    const interval = setInterval(fetchRecommendations, 30000);
    return () => clearInterval(interval);
  }, [fetchRecommendations, refreshKey]);

  if (loading && recommendations.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading partition recommendations...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
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
          background: 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 50%, #f59e0b 100%)',
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
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TableChart sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                Partition Recommendations
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                Table partitioning suggestions
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={recommendations.length}
              size="small"
              sx={{
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                color: '#8b5cf6',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
            <IconButton
              onClick={fetchRecommendations}
              size="small"
              sx={{
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                color: '#8b5cf6',
                '&:hover': {
                  backgroundColor: 'rgba(139, 92, 246, 0.2)',
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
          <Box sx={{ textAlign: 'center', py: 4, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box>
              <CheckCircle sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No partition recommendations available
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                All tables are optimally partitioned
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ flex: 1, overflowY: 'auto', pb: 0.5 }}>
            {recommendations.map((rec) => {
              const improvementPercent = (rec.estimated_improvement * 100).toFixed(1);
              const priorityColors = rec.priority === 'high' 
                ? { bg: '#ef4444', light: '#ef444420', border: '#ef444440' }
                : rec.priority === 'medium'
                ? { bg: '#f59e0b', light: '#f59e0b20', border: '#f59e0b40' }
                : { bg: '#3b82f6', light: '#3b82f620', border: '#3b82f640' };

              return (
                <Box
                  key={rec.recommendation_id}
                  sx={{
                    p: 1.25,
                    mb: 1,
                    borderRadius: 1.5,
                    border: `1px solid ${priorityColors.border}`,
                    background: priorityColors.light,
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
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                        Partition by: {rec.columns.join(', ')}
                      </Typography>
                    </Box>
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
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

