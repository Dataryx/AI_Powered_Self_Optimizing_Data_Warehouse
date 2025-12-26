/**
 * Cache Analytics Component
 * Displays cache performance metrics and analytics.
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useRealtimeMetrics } from '../../hooks/useMetrics';
import { formatPercent } from '../../utils/formatters';

export const CacheAnalytics: React.FC = () => {
  const { metrics, isLoading } = useRealtimeMetrics();

  // Generate sample cache hit rate history (in real implementation, fetch from API)
  const cacheHistory = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    hitRate: 70 + Math.random() * 20,
  }));

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  const cacheHitRate = metrics?.cache_hit_rate || 0;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Cache Analytics
      </Typography>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Current Cache Hit Rate
              </Typography>
              <Box display="flex" alignItems="center" gap={2} mt={2}>
                <Box sx={{ flexGrow: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={cacheHitRate}
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                </Box>
                <Typography variant="h6">{formatPercent(cacheHitRate / 100)}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Cache Hit Rate Trend (24h)
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={cacheHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis label={{ value: 'Hit Rate (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="hitRate"
                    stroke="#8884d8"
                    name="Hit Rate"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CacheAnalytics;


