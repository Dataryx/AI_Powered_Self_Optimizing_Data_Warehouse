/**
 * Index Recommendations Component
 * Displays and manages index optimization recommendations.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Info,
  TrendingUp,
} from '@mui/icons-material';
import { useOptimizations } from '../../hooks/useOptimizations';
import { formatPercent, formatNumber } from '../../utils/formatters';

export const IndexRecommendations: React.FC = () => {
  const { recommendations, isLoading, applyOptimization, isApplying } = useOptimizations();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const indexRecommendations = recommendations?.filter((r) => r.type === 'index') || [];

  const handleApply = async (recommendationId: string) => {
    setApplyingId(recommendationId);
    try {
      await applyOptimization(recommendationId, false);
    } finally {
      setApplyingId(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Index Recommendations
      </Typography>
      {indexRecommendations.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No index recommendations available
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Table</TableCell>
                <TableCell>Columns</TableCell>
                <TableCell>Estimated Improvement</TableCell>
                <TableCell>Cost</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {indexRecommendations.map((rec) => (
                <TableRow key={rec.recommendation_id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {rec.table}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={rec.columns.join(', ')} size="small" />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <TrendingUp color="success" fontSize="small" />
                      <Typography>{formatPercent(rec.estimated_improvement)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{formatNumber(rec.cost)}</TableCell>
                  <TableCell>
                    <Chip
                      label={rec.priority}
                      color={getPriorityColor(rec.priority) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={rec.status}
                      color={rec.status === 'applied' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {rec.status === 'pending' && (
                      <Tooltip title="Apply recommendation">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleApply(rec.recommendation_id)}
                          disabled={isApplying && applyingId === rec.recommendation_id}
                        >
                          {isApplying && applyingId === rec.recommendation_id ? (
                            <CircularProgress size={20} />
                          ) : (
                            <CheckCircle />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
                    {rec.status === 'applied' && (
                      <Tooltip title="Already applied">
                        <CheckCircle color="success" />
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default IndexRecommendations;


