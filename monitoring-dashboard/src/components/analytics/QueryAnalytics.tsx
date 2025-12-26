/**
 * Query Analytics Component
 * Query distribution and performance analytics.
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

export const QueryAnalytics: React.FC = () => {
  // Sample data - in real implementation, fetch from API
  const queryTypeDistribution = [
    { name: 'SELECT', value: 65 },
    { name: 'INSERT', value: 20 },
    { name: 'UPDATE', value: 10 },
    { name: 'DELETE', value: 5 },
  ];

  const slowQueries = [
    { query: 'SELECT * FROM orders...', count: 150, avgTime: 2500 },
    { query: 'JOIN products...', count: 80, avgTime: 3200 },
    { query: 'GROUP BY customer...', count: 45, avgTime: 1800 },
  ];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Query Analytics
      </Typography>
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Query Type Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={queryTypeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {queryTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Slow Queries Analysis
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={slowQueries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="query" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgTime" fill="#8884d8" name="Avg Time (ms)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default QueryAnalytics;


