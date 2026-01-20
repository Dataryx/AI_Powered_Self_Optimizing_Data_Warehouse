/**
 * ETL Job Status Component
 * Displays ETL job status and progress with modern UI
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, LinearProgress, Chip, Grid, IconButton } from '@mui/material';
import { PlayCircle, CheckCircle, Error as ErrorIcon, Refresh, Schedule } from '@mui/icons-material';
import { apiService } from '../../services/api';

interface ETLJob {
  job_id: string;
  job_name: string;
  status: string;
  progress: number;
  started_at: string;
  completed_at?: string;
  records_processed: number;
  layer: string;
  table: string;
}

interface ETLJobStatusProps {
  refreshKey?: number;
}

export const ETLJobStatus: React.FC<ETLJobStatusProps> = ({ refreshKey = 0 }) => {
  const [jobs, setJobs] = useState<ETLJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      setError(null);
      const data = await apiService.getETLJobs();
      setJobs(data.jobs || []);
      setLastFetch(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching ETL jobs:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ETL jobs. Please check if the API is running at http://localhost:8000';
      setError(errorMessage);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 8000); // Refresh every 8 seconds for real-time updates
    return () => clearInterval(interval);
  }, [refreshKey]); // Re-run when refreshKey changes

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle sx={{ color: '#10b981', fontSize: 24 }} />;
      case 'running':
        return <PlayCircle sx={{ color: '#6366f1', fontSize: 24 }} />;
      case 'failed':
        return <ErrorIcon sx={{ color: '#ef4444', fontSize: 24 }} />;
      default:
        return <Schedule sx={{ color: '#64748b', fontSize: 24 }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: '#10b98120', color: '#10b981', border: '#10b98140' };
      case 'running':
        return { bg: '#6366f120', color: '#6366f1', border: '#6366f140' };
      case 'failed':
        return { bg: '#ef444420', color: '#ef4444', border: '#ef444440' };
      default:
        return { bg: '#64748b20', color: '#64748b', border: '#64748b40' };
    }
  };

  if (loading && jobs.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading ETL jobs...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <ErrorIcon sx={{ color: '#ef4444', fontSize: 48, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ef4444', mb: 1 }}>
            Error Loading ETL Jobs
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {error}
          </Typography>
          <IconButton onClick={fetchJobs} sx={{ color: '#6366f1' }}>
            <Refresh /> Retry
          </IconButton>
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Schedule sx={{ color: '#64748b', fontSize: 48, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
            No ETL Jobs Found
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No ETL jobs are currently available. Jobs will appear here when data is processed.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(99, 102, 241, 0.1)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
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
            ETL Job Status
          </Typography>
          <IconButton size="small" onClick={fetchJobs} sx={{ color: '#6366f1' }}>
            <Refresh />
          </IconButton>
        </Box>

        <Grid container spacing={2}>
          {jobs.slice(0, 6).map((job) => {
            const statusColors = getStatusColor(job.status);
            return (
              <Grid item xs={12} md={6} key={job.job_id}>
                <Card
                  sx={{
                    p: 2,
                    background: `linear-gradient(135deg, ${statusColors.bg} 0%, rgba(255,255,255,0.8) 100%)`,
                    border: `2px solid ${statusColors.border}`,
                    borderRadius: 2,
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 8px 16px ${statusColors.border}`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      {getStatusIcon(job.status)}
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                          {job.job_name}
                        </Typography>
                        <Chip
                          label={job.status}
                          size="small"
                          sx={{
                            mt: 0.5,
                            backgroundColor: statusColors.bg,
                            color: statusColors.color,
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            height: '20px',
                          }}
                        />
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                      {job.layer}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        Progress
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: statusColors.color, fontSize: '0.75rem' }}>
                        {job.progress}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={job.progress}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: `${statusColors.color}20`,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: statusColors.color,
                          borderRadius: 4,
                        },
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem' }}>
                        Records
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}>
                        {job.records_processed.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem' }}>
                        Started
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        {new Date(job.started_at).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
};

