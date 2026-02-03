/**
 * Storage & Resource Dashboard Page
 * Enhanced with real-time updates and unique UI design
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, IconButton, Chip, CircularProgress, Paper, Divider } from '@mui/material';
import { Refresh, FiberManualRecord, TrendingUp, TrendingDown } from '@mui/icons-material';
import { StorageUtilization } from '../components/storage/StorageUtilization';
import { GrowthTrends } from '../components/storage/GrowthTrends';
import { CompressionStats } from '../components/storage/CompressionStats';
import { CachePerformance } from '../components/storage/CachePerformance';
import { ResourceAllocation } from '../components/storage/ResourceAllocation';
import { CostTracker } from '../components/storage/CostTracker';
import { apiService } from '../services/api';

export const StorageDashboard: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(true);
  const [kpiData, setKpiData] = useState({
    totalStorage: 0,
    growthRate7d: 0,
    cacheHitRate: 0,
    monthlyCost: 0,
    largestTable: { name: '—', size: 0 },
  });
  const [loadingKPIs, setLoadingKPIs] = useState(true);

  // Fetch KPI data
  const fetchKPIData = useCallback(async () => {
    try {
      setLoadingKPIs(true);
      
      const [utilizationData, growthData, cacheData, costData] = await Promise.all([
        apiService.getStorageUtilization().catch(() => ({ utilization: {} })) as Promise<any>,
        apiService.getGrowthTrends(7).catch(() => ({ trends: [] })) as Promise<any>,
        apiService.getCachePerformance().catch(() => ({ overall: { hit_rate: 0 } })) as Promise<any>,
        apiService.getCostTracking().catch(() => ({ monthly_cost: 0 })) as Promise<any>,
      ]);

      // Calculate total storage (sum of all layers)
      const utilization = utilizationData?.utilization || {};
      let totalStorageGB = 0;
      Object.values(utilization).forEach((layer: any) => {
        if (layer?.tables) {
          layer.tables.forEach((table: any) => {
            const sizeStr = table.size || '0 MB';
            const sizeNum = parseFloat(sizeStr);
            const unit = sizeStr.toUpperCase();
            if (unit.includes('GB')) {
              totalStorageGB += sizeNum;
            } else if (unit.includes('MB')) {
              totalStorageGB += sizeNum / 1024;
            } else if (unit.includes('TB')) {
              totalStorageGB += sizeNum * 1024;
            }
          });
        }
      });

      // Calculate 7-day growth rate
      const trends = growthData?.trends || growthData?.data?.trends || [];
      let growthRate7d = 0;
      if (trends.length >= 2) {
        const sorted = [...trends].sort((a: any, b: any) => 
          new Date(a.date || a.timestamp).getTime() - new Date(b.date || b.timestamp).getTime()
        );
        const first = sorted[0]?.total_size_gb || sorted[0]?.size_gb || 0;
        const last = sorted[sorted.length - 1]?.total_size_gb || sorted[sorted.length - 1]?.size_gb || 0;
        if (first > 0) {
          growthRate7d = ((last - first) / first) * 100;
        }
      }

      // Get cache hit rate
      const cacheHitRate = cacheData?.overall?.hit_rate || cacheData?.hit_rate || 0;

      // Get monthly cost
      const monthlyCost = costData?.monthly_cost || costData?.cost || 0;

      // Find largest table
      let largestTable = { name: '—', size: 0 };
      Object.values(utilization).forEach((layer: any) => {
        if (layer?.tables) {
          layer.tables.forEach((table: any) => {
            const sizeStr = table.size || '0 MB';
            const sizeNum = parseFloat(sizeStr);
            const unit = sizeStr.toUpperCase();
            let sizeGB = 0;
            if (unit.includes('GB')) {
              sizeGB = sizeNum;
            } else if (unit.includes('MB')) {
              sizeGB = sizeNum / 1024;
            } else if (unit.includes('TB')) {
              sizeGB = sizeNum * 1024;
            }
            if (sizeGB > largestTable.size) {
              largestTable = {
                name: table.table || table.name || '—',
                size: sizeGB,
              };
            }
          });
        }
      });

      setKpiData({
        totalStorage: totalStorageGB,
        growthRate7d,
        cacheHitRate,
        monthlyCost,
        largestTable,
      });
      setLoadingKPIs(false);
    } catch (error) {
      console.error('Error fetching KPI data:', error);
      setLoadingKPIs(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIData();
  }, [fetchKPIData, refreshKey]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setLastUpdate(new Date());
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <Box
      sx={{
        p: 3,
        minHeight: '100vh',
        position: 'relative',
        background: 'transparent',
      }}
    >
      {/* Header Section */}
      <Box 
        sx={{ 
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            gutterBottom
            sx={{
              fontWeight: 800,
              mb: 0.5,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.75rem', md: '2rem' },
            }}
          >
            Storage & Resource Dashboard
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary', 
              fontWeight: 500, 
              fontSize: '0.875rem' 
            }}
          >
            Real-time storage utilization, growth trends, compression, cache performance, and cost tracking
          </Typography>
        </Box>

        {/* Status & Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            icon={
              <FiberManualRecord 
                sx={{ 
                  fontSize: '8px !important',
                  color: isLive ? '#10b981' : '#ef4444',
                  animation: isLive ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }} 
              />
            }
            label={isLive ? 'Live' : 'Offline'}
            size="small"
            sx={{
              backgroundColor: isLive ? '#10b98115' : '#ef444415',
              color: isLive ? '#10b981' : '#ef4444',
              fontWeight: 600,
              border: `1px solid ${isLive ? '#10b98140' : '#ef444440'}`,
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            {isLive ? `Updated: ${formatTime(lastUpdate)}` : 'API unavailable'}
          </Typography>
          <IconButton
            onClick={handleRefresh}
            disabled={isRefreshing}
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
            {isRefreshing ? (
              <CircularProgress size={20} sx={{ color: '#6366f1' }} />
            ) : (
              <Refresh />
            )}
          </IconButton>
        </Box>
      </Box>

      {/* Compact KPI Strip */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 2,
          mb: 3,
          display: 'flex',
          gap: 2.5,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ flex: 1, minWidth: '120px' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500, display: 'block', mb: 0.5 }}>
            Total Storage
          </Typography>
          <Typography variant="h6" sx={{ color: '#0f172a', fontSize: '1.125rem', fontWeight: 600 }}>
            {loadingKPIs ? '—' : `${kpiData.totalStorage.toFixed(1)} GB`}
          </Typography>
        </Box>
        
        <Divider orientation="vertical" flexItem sx={{ borderColor: '#e2e8f0' }} />
        
        <Box sx={{ flex: 1, minWidth: '120px' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500, display: 'block', mb: 0.5 }}>
            7-day Growth Rate
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {!loadingKPIs && kpiData.growthRate7d !== 0 && (
              kpiData.growthRate7d > 0 ? (
                <TrendingUp sx={{ fontSize: 16, color: '#16a34a' }} />
              ) : (
                <TrendingDown sx={{ fontSize: 16, color: '#dc2626' }} />
              )
            )}
            <Typography variant="h6" sx={{ color: '#0f172a', fontSize: '1.125rem', fontWeight: 600 }}>
              {loadingKPIs ? '—' : `${kpiData.growthRate7d >= 0 ? '+' : ''}${kpiData.growthRate7d.toFixed(1)}%`}
            </Typography>
          </Box>
        </Box>
        
        <Divider orientation="vertical" flexItem sx={{ borderColor: '#e2e8f0' }} />
        
        <Box sx={{ flex: 1, minWidth: '120px' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500, display: 'block', mb: 0.5 }}>
            Cache Hit Rate
          </Typography>
          <Typography variant="h6" sx={{ color: '#0f172a', fontSize: '1.125rem', fontWeight: 600 }}>
            {loadingKPIs ? '—' : `${(kpiData.cacheHitRate * 100).toFixed(1)}%`}
          </Typography>
        </Box>
        
        <Divider orientation="vertical" flexItem sx={{ borderColor: '#e2e8f0' }} />
        
        <Box sx={{ flex: 1, minWidth: '120px' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500, display: 'block', mb: 0.5 }}>
            Monthly Cost
          </Typography>
          <Typography variant="h6" sx={{ color: '#0f172a', fontSize: '1.125rem', fontWeight: 600 }}>
            {loadingKPIs ? '—' : `$${kpiData.monthlyCost.toFixed(2)}`}
          </Typography>
        </Box>
        
        <Divider orientation="vertical" flexItem sx={{ borderColor: '#e2e8f0' }} />
        
        <Box sx={{ flex: 1, minWidth: '120px' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500, display: 'block', mb: 0.5 }}>
            Largest Table
          </Typography>
          <Box>
            <Typography variant="h6" sx={{ color: '#0f172a', fontSize: '1.125rem', fontWeight: 600, mb: 0.25 }}>
              {kpiData.largestTable.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.6875rem' }}>
              {kpiData.largestTable.size > 0 ? `${kpiData.largestTable.size.toFixed(2)} GB` : '—'}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Storage Utilization - Full Width */}
      <Box sx={{ mb: 3 }}>
        <StorageUtilization refreshKey={refreshKey} />
      </Box>

      {/* Growth Trends - Full Width */}
      <Box sx={{ mb: 3 }}>
        <GrowthTrends refreshKey={refreshKey} />
      </Box>

      {/* Compression and Cache - Side by Side */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
          <CompressionStats refreshKey={refreshKey} />
          <CachePerformance refreshKey={refreshKey} />
        </Box>
      </Box>

      {/* Resources and Cost - Side by Side */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
          <ResourceAllocation refreshKey={refreshKey} />
          <CostTracker refreshKey={refreshKey} />
        </Box>
      </Box>
    </Box>
  );
};
