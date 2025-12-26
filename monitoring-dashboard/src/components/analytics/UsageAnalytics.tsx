/**
 * Usage Analytics Component
 * User activity and table access patterns.
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export const UsageAnalytics: React.FC = () => {
  // Sample data - in real implementation, fetch from API
  const peakHours = [
    { hour: '00:00', queries: 100 },
    { hour: '04:00', queries: 50 },
    { hour: '08:00', queries: 500 },
    { hour: '12:00', queries: 800 },
    { hour: '16:00', queries: 750 },
    { hour: '20:00', queries: 400 },
  ];

  const topTables = [
    { table: 'silver.orders', accesses: 12500 },
    { table: 'silver.products', accesses: 8900 },
    { table: 'gold.daily_sales_summary', accesses: 5600 },
    { table: 'silver.customers', accesses: 3400 },
    { table: 'gold.customer_360', accesses: 2100 },
  ];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Usage Analytics
      </Typography>
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Query Activity by Hour
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis label={{ value: 'Queries', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="queries" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Most Accessed Tables
          </Typography>
          <List>
            {topTables.map((item, index) => (
              <ListItem
                key={item.table}
                secondaryAction={
                  <Chip label={item.accesses.toLocaleString()} color="primary" size="small" />
                }
              >
                <ListItemText primary={`${index + 1}. ${item.table}`} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UsageAnalytics;


