import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Button,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Error as ErrorIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';

export interface OptimizationRecommendation {
  id: string;
  type: 'index' | 'partition' | 'cache';
  table: string;
  columns: string[];
  estimatedImprovement: number;
  cost: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'applied' | 'rejected' | 'failed';
  description: string;
  sql?: string;
  createdAt: string;
}

interface OptimizationRecommendationCardProps {
  recommendation: OptimizationRecommendation;
  onApprove?: (id: string) => void;
  onApply?: (id: string) => void;
  onReject?: (id: string) => void;
}

const typeConfig = {
  index: {
    icon: <StorageIcon />,
    color: 'rgba(255, 255, 255, 0.8)',
    label: 'Index',
  },
  partition: {
    icon: <SpeedIcon />,
    color: 'rgba(255, 255, 255, 0.8)',
    label: 'Partition',
  },
  cache: {
    icon: <MemoryIcon />,
    color: 'rgba(255, 255, 255, 0.8)',
    label: 'Cache',
  },
};

const statusConfig = {
  pending: {
    icon: <PendingIcon />,
    color: 'rgba(255, 255, 255, 0.7)',
    label: 'Pending',
    bgColor: 'rgba(255, 255, 255, 0.1)',
  },
  approved: {
    icon: <CheckCircleIcon />,
    color: 'rgba(148, 163, 184, 0.9)',
    label: 'Approved',
    bgColor: 'rgba(148, 163, 184, 0.15)',
  },
  applied: {
    icon: <CheckCircleIcon />,
    color: 'rgba(148, 163, 184, 0.9)',
    label: 'Applied',
    bgColor: 'rgba(148, 163, 184, 0.15)',
  },
  rejected: {
    icon: <ErrorIcon />,
    color: 'rgba(239, 68, 68, 0.8)',
    label: 'Rejected',
    bgColor: 'rgba(239, 68, 68, 0.15)',
  },
  failed: {
    icon: <ErrorIcon />,
    color: 'rgba(239, 68, 68, 0.8)',
    label: 'Failed',
    bgColor: 'rgba(239, 68, 68, 0.15)',
  },
};

const priorityConfig = {
  high: { color: 'rgba(255, 255, 255, 0.7)', bgColor: 'rgba(255, 255, 255, 0.1)' },
  medium: { color: 'rgba(255, 255, 255, 0.6)', bgColor: 'rgba(255, 255, 255, 0.08)' },
  low: { color: 'rgba(255, 255, 255, 0.5)', bgColor: 'rgba(255, 255, 255, 0.06)' },
};

export const OptimizationRecommendationCard: React.FC<OptimizationRecommendationCardProps> = ({
  recommendation,
  onApprove,
  onApply,
  onReject,
}) => {
  const type = typeConfig[recommendation.type];
  const status = statusConfig[recommendation.status];
  const priority = priorityConfig[recommendation.priority];

  return (
    <Card
      sx={{
        height: '100%',
        width: '100%',
        background: 'rgba(17, 17, 26, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: 'rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1.5,
                background: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {type.icon}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffffff', mb: 0.5 }}>
                {type.label} Optimization
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem' }}>
                {recommendation.table}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', alignItems: 'flex-end' }}>
            <Chip
              icon={status.icon}
              label={status.label}
              size="small"
              sx={{
                background: status.bgColor,
                color: status.color,
                fontWeight: 500,
                fontSize: '0.75rem',
                border: `1px solid ${status.color}30`,
                '& .MuiChip-icon': {
                  color: 'inherit',
                },
              }}
            />
            <Chip
              label={recommendation.priority.toUpperCase()}
              size="small"
              sx={{
                background: priority.bgColor,
                color: priority.color,
                fontWeight: 500,
                fontSize: '0.7rem',
                height: 20,
                border: `1px solid ${priority.color}20`,
              }}
            />
          </Box>
        </Box>

        {/* Description */}
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 2, lineHeight: 1.6 }}>
          {recommendation.description}
        </Typography>

        {/* Columns */}
        {recommendation.columns.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1, display: 'block' }}>
              Columns:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {recommendation.columns.map((col, idx) => (
                <Chip
                  key={idx}
                  label={col}
                  size="small"
                  sx={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '0.75rem',
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Metrics */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              Estimated Improvement
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
              {recommendation.estimatedImprovement.toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(recommendation.estimatedImprovement, 100)}
            sx={{
              height: 8,
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                background: '#64748b',
                borderRadius: 4,
              },
            }}
          />
        </Box>

        {/* Cost */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Estimated Cost
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
            {recommendation.cost.toFixed(2)} MB
          </Typography>
        </Box>

        {/* SQL Preview */}
        {recommendation.sql && (
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              mb: 2,
            }}
          >
            <Typography
              variant="caption"
              component="pre"
              sx={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {recommendation.sql}
            </Typography>
          </Box>
        )}

        {/* Actions */}
        {recommendation.status === 'pending' && (
          <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<CheckCircleIcon />}
              onClick={() => onApprove?.(recommendation.id)}
              sx={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                fontWeight: 500,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
              }}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              onClick={() => onReject?.(recommendation.id)}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: 'rgba(255, 255, 255, 0.8)',
                fontWeight: 500,
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  background: 'rgba(255, 255, 255, 0.05)',
                },
              }}
            >
              Reject
            </Button>
          </Box>
        )}

        {recommendation.status === 'approved' && (
          <Button
            variant="contained"
            fullWidth
            startIcon={<PlayArrowIcon />}
            onClick={() => onApply?.(recommendation.id)}
            sx={{
              mt: 2,
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontWeight: 500,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.15)',
                borderColor: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          >
            Apply Optimization
          </Button>
        )}

        {/* Timestamp */}
        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', mt: 2, display: 'block' }}>
          Created: {new Date(recommendation.createdAt).toLocaleString()}
        </Typography>
      </CardContent>
    </Card>
  );
};

