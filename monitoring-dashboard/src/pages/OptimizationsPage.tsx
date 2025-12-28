import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Tabs, Tab, Button, Snackbar, Alert } from '@mui/material';
import {
  getOptimizationRecommendations,
  getOptimizationHistory,
  getOptimizationMetrics,
  approveOptimization,
  applyOptimization,
  rejectOptimization,
  OptimizationRecommendation,
  OptimizationHistoryItem,
} from '../services/api';
import { OptimizationRecommendationCard } from '../components/optimization/OptimizationRecommendationCard';
import { OptimizationHistory } from '../components/optimization/OptimizationHistory';
import { OptimizationMetrics } from '../components/optimization/OptimizationMetrics';
import RefreshIcon from '@mui/icons-material/Refresh';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`optimization-tabpanel-${index}`}
      aria-labelledby={`optimization-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const OptimizationsPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [history, setHistory] = useState<OptimizationHistoryItem[]>([]);
  const [metrics, setMetrics] = useState({
    totalRecommendations: 0,
    appliedCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    avgImprovement: 0,
    totalTimeSaved: 0,
  });
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [recs, hist, met] = await Promise.all([
        getOptimizationRecommendations(),
        getOptimizationHistory(),
        getOptimizationMetrics(),
      ]);
      setRecommendations(recs);
      setHistory(hist);
      setMetrics(met);
    } catch (error) {
      console.error('Error loading optimization data:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load optimization data',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleApprove = async (id: string) => {
    try {
      await approveOptimization(id);
      setSnackbar({
        open: true,
        message: 'Optimization approved successfully',
        severity: 'success',
      });
      loadData();
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to approve optimization',
        severity: 'error',
      });
    }
  };

  const handleApply = async (id: string) => {
    try {
      await applyOptimization(id);
      setSnackbar({
        open: true,
        message: 'Optimization applied successfully',
        severity: 'success',
      });
      loadData();
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to apply optimization',
        severity: 'error',
      });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectOptimization(id);
      setSnackbar({
        open: true,
        message: 'Optimization rejected',
        severity: 'success',
      });
      loadData();
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to reject optimization',
        severity: 'error',
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const pendingRecommendations = recommendations.filter((r) => r.status === 'pending');
  const approvedRecommendations = recommendations.filter((r) => r.status === 'approved');

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: '1400px' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            Optimizations
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
            sx={{
              borderColor: 'rgba(99, 102, 241, 0.5)',
              color: '#6366f1',
              fontWeight: 600,
              '&:hover': {
                borderColor: '#6366f1',
                background: 'rgba(99, 102, 241, 0.1)',
              },
            }}
          >
            Refresh
          </Button>
        </Box>

        {/* Metrics */}
        <Box sx={{ mb: 4 }}>
          <OptimizationMetrics {...metrics} />
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.1)', mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                color: 'rgba(255, 255, 255, 0.6)',
                fontWeight: 600,
                textTransform: 'none',
                '&.Mui-selected': {
                  color: '#6366f1',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#6366f1',
              },
            }}
          >
            <Tab label={`Pending (${pendingRecommendations.length})`} />
            <Tab label={`Approved (${approvedRecommendations.length})`} />
            <Tab label="History" />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {pendingRecommendations.length === 0 ? (
              <Grid item xs={12}>
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 6,
                    color: 'rgba(255, 255, 255, 0.5)',
                  }}
                >
                  <Typography variant="body1">No pending recommendations</Typography>
                </Box>
              </Grid>
            ) : (
              pendingRecommendations.map((rec) => (
                <Grid item xs={12} md={6} key={rec.id}>
                  <OptimizationRecommendationCard
                    recommendation={rec}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                </Grid>
              ))
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            {approvedRecommendations.length === 0 ? (
              <Grid item xs={12}>
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 6,
                    color: 'rgba(255, 255, 255, 0.5)',
                  }}
                >
                  <Typography variant="body1">No approved recommendations</Typography>
                </Box>
              </Grid>
            ) : (
              approvedRecommendations.map((rec) => (
                <Grid item xs={12} md={6} key={rec.id}>
                  <OptimizationRecommendationCard
                    recommendation={rec}
                    onApply={handleApply}
                  />
                </Grid>
              ))
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <OptimizationHistory history={history} />
        </TabPanel>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            sx={{
              background: snackbar.severity === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
              color: '#ffffff',
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default OptimizationsPage;

