/**
 * Partition Recommendations Component
 * Displays and manages partition optimization recommendations.
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  CircularProgress,
} from '@mui/material';
import { TrendingUp } from '@mui/icons-material';
import { useOptimizations } from '../../hooks/useOptimizations';
import { formatPercent } from '../../utils/formatters';

export const PartitionRecommendations: React.FC = () => {
  const { recommendations, isLoading, applyOptimization } = useOptimizations();

  const partitionRecommendations = recommendations?.filter((r) => r.type === 'partition') || [];

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
        Partition Recommendations
      </Typography>
      {partitionRecommendations.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No partition recommendations available
        </Typography>
      ) : (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {partitionRecommendations.map((rec) => (
            <Grid item xs={12} md={6} key={rec.recommendation_id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                    <Typography variant="h6">{rec.table}</Typography>
                    <Chip
                      label={rec.status}
                      color={rec.status === 'applied' ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <TrendingUp color="success" />
                    <Typography>
                      Estimated improvement: {formatPercent(rec.estimated_improvement)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Columns: {rec.columns.join(', ')}
                  </Typography>
                  {rec.status === 'pending' && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => applyOptimization(rec.recommendation_id)}
                      sx={{ mt: 2 }}
                    >
                      Apply Recommendation
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default PartitionRecommendations;


