/**
 * ETL Monitoring Dashboard
 * Enterprise-grade monitoring interface for AI-powered Data Warehouse
 * Clean, minimal, professional design with human-in-the-loop AI insights
 */

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  IconButton, 
  Chip, 
  Card, 
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Paper
} from '@mui/material';
import { Refresh, CheckCircle, Error as ErrorIcon, Warning, TrendingUp } from '@mui/icons-material';
import { ETLJobStatus } from '../components/monitoring/ETLJobStatus';
import { PipelineDAG } from '../components/monitoring/PipelineDAG';
import { DataFreshness } from '../components/monitoring/DataFreshness';
import { ErrorRetryTracker } from '../components/monitoring/ErrorRetryTracker';
import { DataQualityMetrics } from '../components/monitoring/DataQualityMetrics';
import { ApiStatusChecker } from '../components/common/ApiStatusChecker';
import { apiService } from '../services/api';

export const MonitoringDashboard: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [environment, setEnvironment] = useState('production');
  const [kpiData, setKpiData] = useState({
    activePipelines: 0,
    failedRuns24h: 0,
    freshnessSLA: { onTime: 0, atRisk: 0, total: 0 },
    avgDuration: { current: 0, baseline: 0, delta: 0 },
    mlAnomalies: 0,
  });
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch KPI data from API
  const fetchKPIData = async () => {
    try {
      setLoading(true);
      
      // Fetch all required data in parallel
      const [jobsData, freshnessData, anomaliesData] = await Promise.all([
        apiService.getETLJobs().catch(() => ({ jobs: [] })) as Promise<any>,
        apiService.getDataFreshness().catch(() => ({ freshness: {} })) as Promise<any>,
        apiService.getAnomalies().catch(() => ({ anomalies: [] })) as Promise<any>,
      ]);

      const jobs = (jobsData?.jobs || []) as any[];
      const freshness = (freshnessData?.freshness || {}) as any;
      const anomaliesList = (anomaliesData?.anomalies || anomaliesData?.data?.anomalies || []) as any[];

      // Calculate active pipelines (running jobs)
      const activePipelines = jobs.filter((job: any) => 
        job.status === 'running' || job.status === 'in_progress'
      ).length;

      // Calculate failed runs in last 24h
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const failedRuns24h = jobs.filter((job: any) => {
        if (job.status !== 'failed' && job.status !== 'error') return false;
        const jobTime = job.completed_at ? new Date(job.completed_at) : new Date(job.started_at);
        return jobTime >= last24h;
      }).length;

      // Calculate freshness SLA
      const allTables: any[] = [];
      Object.values(freshness).forEach((layerData: any) => {
        if (layerData?.tables) {
          allTables.push(...layerData.tables);
        }
      });
      
      const onTime = allTables.filter((t: any) => {
        const hoursAgo = t.hours_ago || 0;
        return hoursAgo < 1;
      }).length;
      
      const atRisk = allTables.filter((t: any) => {
        const hoursAgo = t.hours_ago || 0;
        return hoursAgo >= 1 && hoursAgo < 24;
      }).length;

      // Calculate average duration
      const completedJobs = jobs.filter((job: any) => 
        job.status === 'completed' && job.completed_at && job.started_at
      );
      
      let avgDuration = 0;
      let baseline = 120; // Default baseline in seconds
      
      if (completedJobs.length > 0) {
        const durations = completedJobs.map((job: any) => {
          const start = new Date(job.started_at).getTime();
          const end = new Date(job.completed_at).getTime();
          return Math.round((end - start) / 1000);
        });
        avgDuration = Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length);
        // Use median as baseline
        const sorted = [...durations].sort((a, b) => a - b);
        baseline = sorted[Math.floor(sorted.length / 2)];
      }

      setKpiData({
        activePipelines,
        failedRuns24h,
        freshnessSLA: {
          onTime,
          atRisk,
          total: allTables.length,
        },
        avgDuration: {
          current: avgDuration,
          baseline,
          delta: avgDuration - baseline,
        },
        mlAnomalies: anomaliesList.length,
      });

      setAnomalies(anomaliesList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching KPI data:', error);
      setLoading(false);
    }
  };

  // Fetch data on mount and when refresh key changes
  useEffect(() => {
    fetchKPIData();
  }, [refreshKey]);

  // Track when components actually fetch data
  useEffect(() => {
    // Components will handle their own refresh
  }, [refreshKey]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: '#fafbfc',
        fontFamily: '"Inter", "SF Pro Display", "Roboto", sans-serif',
      }}
    >
      {/* API Status Checker */}
      <ApiStatusChecker />

      <Box sx={{ maxWidth: '1400px', mx: 'auto', p: 4 }}>
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 600,
                  color: '#0f172a',
                  fontSize: '1.875rem',
                  letterSpacing: '-0.02em',
                  mb: 0.5,
                }}
              >
                ETL Monitoring
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: '#64748b',
                  fontSize: '0.9375rem',
                  fontWeight: 300,
                }}
              >
                Real-time pipeline health and data freshness
              </Typography>
            </Box>
            
            {/* Header Controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Time Range</InputLabel>
                <Select
                  value={timeRange}
                  label="Time Range"
                  onChange={(e) => setTimeRange(e.target.value)}
                  sx={{
                    fontSize: '0.875rem',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e2e8f0',
                    },
                  }}
                >
                  <MenuItem value="1h">Last Hour</MenuItem>
                  <MenuItem value="24h">Last 24 Hours</MenuItem>
                  <MenuItem value="7d">Last 7 Days</MenuItem>
                  <MenuItem value="30d">Last 30 Days</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Environment</InputLabel>
                <Select
                  value={environment}
                  label="Environment"
                  onChange={(e) => setEnvironment(e.target.value)}
                  sx={{
                    fontSize: '0.875rem',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e2e8f0',
                    },
                  }}
                >
                  <MenuItem value="production">Production</MenuItem>
                  <MenuItem value="staging">Staging</MenuItem>
                  <MenuItem value="development">Development</MenuItem>
                </Select>
              </FormControl>
              
              <IconButton
                onClick={handleRefresh}
                disabled={isRefreshing || !isOnline}
                size="small"
                sx={{
                  color: '#6366f1',
                  '&:hover': { backgroundColor: '#f1f5f9' },
                  '&:disabled': { opacity: 0.4 },
                }}
              >
                <Refresh sx={{ fontSize: 18, animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
              </IconButton>
            </Box>
          </Box>

          {/* Top KPI Strip */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 2,
              display: 'flex',
              gap: 3,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ flex: 1, minWidth: '140px' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500, display: 'block', mb: 0.5 }}>
                Active Pipelines
              </Typography>
              <Typography variant="h6" sx={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: 600 }}>
                {kpiData.activePipelines}
              </Typography>
            </Box>
            
            <Divider orientation="vertical" flexItem sx={{ borderColor: '#e2e8f0' }} />
            
            <Box sx={{ flex: 1, minWidth: '140px' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500, display: 'block', mb: 0.5 }}>
                Failed Runs (24h)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ color: kpiData.failedRuns24h > 0 ? '#dc2626' : '#0f172a', fontSize: '1.25rem', fontWeight: 600 }}>
                  {kpiData.failedRuns24h}
                </Typography>
                {kpiData.failedRuns24h > 0 && <ErrorIcon sx={{ fontSize: 18, color: '#dc2626' }} />}
              </Box>
            </Box>
            
            <Divider orientation="vertical" flexItem sx={{ borderColor: '#e2e8f0' }} />
            
            <Box sx={{ flex: 1, minWidth: '140px' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500, display: 'block', mb: 0.5 }}>
                Data Freshness SLA
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: 600 }}>
                  {kpiData.freshnessSLA.onTime}/{kpiData.freshnessSLA.total}
                </Typography>
                <Chip
                  label={kpiData.freshnessSLA.atRisk > 0 ? `${kpiData.freshnessSLA.atRisk} at risk` : 'On time'}
                  size="small"
                  sx={{
                    backgroundColor: kpiData.freshnessSLA.atRisk > 0 ? '#fef3c7' : '#f0fdf4',
                    color: kpiData.freshnessSLA.atRisk > 0 ? '#92400e' : '#166534',
                    fontSize: '0.6875rem',
                    height: '20px',
                    fontWeight: 500,
                  }}
                />
              </Box>
            </Box>
            
            <Divider orientation="vertical" flexItem sx={{ borderColor: '#e2e8f0' }} />
            
            <Box sx={{ flex: 1, minWidth: '140px' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500, display: 'block', mb: 0.5 }}>
                Avg ETL Duration
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: 600 }}>
                  {kpiData.avgDuration.current}s
                </Typography>
                <Chip
                  icon={<TrendingUp sx={{ fontSize: 12 }} />}
                  label={`+${kpiData.avgDuration.delta}s vs baseline`}
                  size="small"
                  sx={{
                    backgroundColor: kpiData.avgDuration.delta > 10 ? '#fef2f2' : '#f0fdf4',
                    color: kpiData.avgDuration.delta > 10 ? '#991b1b' : '#166534',
                    fontSize: '0.6875rem',
                    height: '20px',
                    fontWeight: 500,
                  }}
                />
              </Box>
            </Box>
            
            <Divider orientation="vertical" flexItem sx={{ borderColor: '#e2e8f0' }} />
            
            <Box sx={{ flex: 1, minWidth: '140px' }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500, display: 'block', mb: 0.5 }}>
                ML-Detected Anomalies
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ color: kpiData.mlAnomalies > 0 ? '#dc2626' : '#0f172a', fontSize: '1.25rem', fontWeight: 600 }}>
                  {kpiData.mlAnomalies}
                </Typography>
                {kpiData.mlAnomalies > 0 && <Warning sx={{ fontSize: 18, color: '#dc2626' }} />}
              </Box>
            </Box>
          </Paper>
        </Box>

        {/* ETL Lineage Visualization */}
        <Box sx={{ mb: 4 }}>
          <PipelineDAG key={`dag-${refreshKey}`} />
        </Box>

        {/* Recent ETL Runs */}
        <Box sx={{ mb: 4 }}>
          <ETLJobStatus key={`jobs-${refreshKey}`} />
        </Box>

        {/* Data Freshness & SLA */}
        <Box sx={{ mb: 4 }}>
          <DataFreshness key={`freshness-${refreshKey}`} />
        </Box>

        {/* Two Column Layout */}
        <Grid container spacing={3}>
          {/* AI/ML Insights */}
          <Grid item xs={12} lg={6}>
            <Card
              elevation={0}
              sx={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                height: '100%',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    color: '#0f172a',
                    fontSize: '1rem',
                    mb: 3,
                  }}
                >
                  Intelligent Insights
                </Typography>
                
                {loading ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.875rem' }}>
                      Loading insights...
                    </Typography>
                  </Box>
                ) : anomalies.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {anomalies.slice(0, 3).map((anomaly: any, index: number) => (
                      <Paper
                        key={anomaly.anomaly_id || anomaly.id || index}
                        elevation={0}
                        sx={{
                          p: 2,
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: 1.5,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                          <Warning sx={{ fontSize: 20, color: '#dc2626', mt: 0.25 }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mb: 0.5 }}>
                              {anomaly.title || anomaly.message || anomaly.description || 'Anomaly Detected'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                              {anomaly.description || anomaly.details || anomaly.message || 'Anomaly detected in system behavior.'}
                            </Typography>
                            {anomaly.root_cause && (
                              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem', display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                                Likely root cause: {anomaly.root_cause}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
                          {anomaly.confidence && (
                            <Chip
                              label={`Confidence: ${Math.round(anomaly.confidence * 100)}%`}
                              size="small"
                              sx={{
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                                fontSize: '0.6875rem',
                                height: '20px',
                                fontWeight: 500,
                              }}
                            />
                          )}
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                            Advisory - Review recommended
                          </Typography>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CheckCircle sx={{ fontSize: 40, color: '#10b981', mb: 1.5 }} />
                    <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.875rem' }}>
                      No anomalies detected. All systems operating normally.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Data Quality */}
          <Grid item xs={12} lg={6}>
            <DataQualityMetrics key={`quality-${refreshKey}`} />
          </Grid>

          {/* Errors & Retries */}
          <Grid item xs={12}>
            <ErrorRetryTracker key={`errors-${refreshKey}`} />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

