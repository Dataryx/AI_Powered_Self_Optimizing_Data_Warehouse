/**
 * Resource Allocation Component
 * Displays resource allocation history and current usage
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Grid } from '@mui/material';
import { Dns, Memory, Storage as StorageIcon } from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { apiService } from '../../services/api';

interface ResourceData {
  connections: {
    total: number;
    active: number;
    idle: number;
  };
  database_size: string;
  timestamp: string;
}

export const ResourceAllocation: React.FC = () => {
  const [resources, setResources] = useState<ResourceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchResources();
    const interval = setInterval(fetchResources, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchResources = async () => {
    try {
      const data = await apiService.getResourceAllocation();
      setResources(data);
      
      // Add to history
      setHistory((prev) => {
        const newHistory = [...prev, { ...data, time: new Date().toLocaleTimeString() }];
        return newHistory.slice(-20); // Keep last 20 points
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching resource allocation:', err);
      setLoading(false);
    }
  };

  if (loading || !resources) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading resource allocation...</Typography>
        </CardContent>
      </Card>
    );
  }

  const connectionUtilization = resources.connections.total > 0
    ? (resources.connections.active / resources.connections.total) * 100
    : 0;

  const chartData = history.map((point, index) => ({
    time: point.time,
    active: point.connections.active,
    idle: point.connections.idle,
    total: point.connections.total,
  }));

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(99, 102, 241, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            mb: 2.5,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: '1.1rem',
          }}
        >
          Resource Allocation
        </Typography>

        {/* Current Resource Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                p: 2,
                background: 'linear-gradient(135deg, #6366f120 0%, rgba(255,255,255,0.9) 100%)',
                border: '2px solid #6366f140',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Dns sx={{ color: '#6366f1', fontSize: 32 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Connections
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#6366f1' }}>
                    {resources.connections.total}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                    Active
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#10b981' }}>
                    {resources.connections.active}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                    Idle
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b' }}>
                    {resources.connections.idle}
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                p: 2,
                background: 'linear-gradient(135deg, #10b98120 0%, rgba(255,255,255,0.9) 100%)',
                border: '2px solid #10b98140',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Memory sx={{ color: '#10b981', fontSize: 32 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Utilization
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#10b981' }}>
                    {connectionUtilization.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
              <Box
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#10b98120',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${connectionUtilization}%`,
                    background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
                    borderRadius: 4,
                  }}
                />
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                p: 2,
                background: 'linear-gradient(135deg, #ec489920 0%, rgba(255,255,255,0.9) 100%)',
                border: '2px solid #ec489940',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <StorageIcon sx={{ color: '#ec4899', fontSize: 32 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Database Size
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#ec4899', fontSize: '1.2rem' }}>
                    {resources.database_size}
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>
        </Grid>

        {/* Connection History Chart */}
        {history.length > 0 && (
          <Box sx={{ width: '100%', height: 300 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Connection History (Last 20 Updates)
            </Typography>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorIdle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  style={{ fontSize: '11px' }}
                />
                <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: 12,
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="active"
                  stroke="#6366f1"
                  fill="url(#colorActive)"
                  name="Active Connections"
                  strokeWidth={2}
                  animationDuration={1000}
                />
                <Area
                  type="monotone"
                  dataKey="idle"
                  stroke="#64748b"
                  fill="url(#colorIdle)"
                  name="Idle Connections"
                  strokeWidth={2}
                  animationDuration={1000}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#ec4899"
                  fill="transparent"
                  name="Total Connections"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

