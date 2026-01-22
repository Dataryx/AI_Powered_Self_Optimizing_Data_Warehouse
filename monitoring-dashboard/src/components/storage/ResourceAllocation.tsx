/**
 * Resource Allocation Component
 * Enhanced with real-time updates
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Grid, 
  IconButton,
  Tooltip,
} from '@mui/material';
import { Refresh, Dns, Memory, Storage as StorageIcon } from '@mui/icons-material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
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

interface ResourceAllocationProps {
  refreshKey?: number;
}

export const ResourceAllocation: React.FC<ResourceAllocationProps> = ({ refreshKey = 0 }) => {
  const [resources, setResources] = useState<ResourceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchResources = useCallback(async () => {
    try {
      const data = await apiService.getResourceAllocation();
      setResources(data);
      setLastUpdate(new Date());
      
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
  }, []);

  useEffect(() => {
    fetchResources();
    const interval = setInterval(fetchResources, 30000);
    return () => clearInterval(interval);
  }, [fetchResources, refreshKey]);

  if (loading && !resources) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading resource allocation...</Typography>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no resource data
  if (!resources) {
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
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
          },
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Dns sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontSize: '1.1rem',
                  }}
                >
                  Resource Allocation
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  API unavailable
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Refresh">
              <IconButton
                onClick={fetchResources}
                size="small"
                sx={{
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  color: '#6366f1',
                  '&:hover': {
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    transform: 'rotate(180deg)',
                  },
                  transition: 'all 0.3s',
                }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No resource allocation data available
            </Typography>
          </Box>
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
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        maxHeight: '600px',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
        },
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Dns sx={{ color: 'white', fontSize: 16 }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: '0.85rem',
                  lineHeight: 1.2,
                  mb: 0.25,
                }}
              >
                Resource Allocation
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                Updated: {lastUpdate.toLocaleTimeString()}
              </Typography>
            </Box>
          </Box>
          <Tooltip title="Refresh">
            <IconButton
              onClick={fetchResources}
              size="small"
              sx={{
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#6366f1',
                width: '28px',
                height: '28px',
                '&:hover': {
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  transform: 'rotate(180deg)',
                },
                transition: 'all 0.3s',
              }}
            >
              <Refresh sx={{ fontSize: '14px' }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Current Resource Cards */}
        <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                p: 1.25,
                background: 'linear-gradient(135deg, #6366f120 0%, rgba(255,255,255,0.9) 100%)',
                border: '1.5px solid #6366f140',
                borderRadius: 1.5,
                transition: 'all 0.3s',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 8px rgba(99, 102, 241, 0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Dns sx={{ color: '#6366f1', fontSize: 20 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.65rem' }}>
                    Connections
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#6366f1', fontSize: '1rem' }}>
                    {resources.connections.total}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                    Active
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#10b981', fontSize: '0.75rem' }}>
                    {resources.connections.active}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                    Idle
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.75rem' }}>
                    {resources.connections.idle}
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                p: 1.25,
                background: 'linear-gradient(135deg, #10b98120 0%, rgba(255,255,255,0.9) 100%)',
                border: '1.5px solid #10b98140',
                borderRadius: 1.5,
                transition: 'all 0.3s',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 8px rgba(16, 185, 129, 0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Memory sx={{ color: '#10b981', fontSize: 20 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.65rem' }}>
                    Utilization
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#10b981', fontSize: '1rem' }}>
                    {connectionUtilization.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
              <Box
                sx={{
                  height: 6,
                  borderRadius: 3,
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
                    borderRadius: 3,
                    transition: 'width 0.3s',
                  }}
                />
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                p: 1.25,
                background: 'linear-gradient(135deg, #ec489920 0%, rgba(255,255,255,0.9) 100%)',
                border: '1.5px solid #ec489940',
                borderRadius: 1.5,
                transition: 'all 0.3s',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 8px rgba(236, 72, 153, 0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StorageIcon sx={{ color: '#ec4899', fontSize: 20 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.65rem' }}>
                    Database Size
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#ec4899', fontSize: '0.95rem' }}>
                    {resources.database_size}
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>
        </Grid>

        {/* Connection History Chart */}
        {history.length > 0 && (
          <Box 
            sx={{ 
              width: '100%', 
              height: 180,
              p: 1,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(255,255,255,0.5) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.1)',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.7rem' }}>
              Connection History (Last 20 Updates)
            </Typography>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorIdle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  style={{ fontSize: '9px' }}
                />
                <YAxis stroke="#64748b" style={{ fontSize: '9px' }} width={30} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: 8,
                    fontSize: '10px',
                    padding: '4px 8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="active"
                  stroke="#6366f1"
                  fill="url(#colorActive)"
                  name="Active Connections"
                  strokeWidth={1.5}
                  animationDuration={1000}
                />
                <Area
                  type="monotone"
                  dataKey="idle"
                  stroke="#64748b"
                  fill="url(#colorIdle)"
                  name="Idle Connections"
                  strokeWidth={1.5}
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
