/**
 * ETL Lineage Visualization Component
 * Enterprise-grade horizontal swimlane visualization
 * Clean DAG nodes with status indicators and hover tooltips
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Paper, Chip, Tooltip } from '@mui/material';
import { ArrowForward, DataObject, Storage, TableChart, Transform, CheckCircle, Warning, Error as ErrorIcon } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { useThemeColors } from '../../theme/useThemeColors';

interface DAGNode {
  id: string;
  label: string;
  type: string;
  layer: string;
}

interface DAGEdge {
  from: string;
  to: string;
}

interface PipelineDAGProps {
  refreshKey?: number;
}

interface ETLJob {
  job_id: string;
  job_name: string;
  status: string;
  started_at: string;
  completed_at?: string;
  records_processed: number;
  layer: string;
  table: string;
}

export const PipelineDAG: React.FC<PipelineDAGProps> = ({ refreshKey = 0 }) => {
  const colors = useThemeColors();
  const [nodes, setNodes] = useState<DAGNode[]>([]);
  const [edges, setEdges] = useState<DAGEdge[]>([]);
  const [etlJobs, setEtlJobs] = useState<ETLJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDAG();
    fetchETLJobs();
    // DAG structure doesn't change frequently, refresh every 60 seconds
    const interval = setInterval(() => {
      fetchDAG();
      fetchETLJobs();
    }, 60000);
    return () => clearInterval(interval);
  }, [refreshKey]); // Re-run when refreshKey changes

  const fetchDAG = async () => {
    try {
      const data = await apiService.getPipelineDAG() as any;
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching pipeline DAG:', err);
      setLoading(false);
    }
  };

  const fetchETLJobs = async () => {
    try {
      const data = await apiService.getETLJobs() as any;
      setEtlJobs(data.jobs || []);
    } catch (err) {
      console.error('Error fetching ETL jobs for DAG:', err);
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'source':
        return <Storage sx={{ fontSize: 18 }} />;
      case 'transform':
        return <Transform sx={{ fontSize: 18 }} />;
      case 'aggregate':
        return <DataObject sx={{ fontSize: 18 }} />;
      case 'table':
        return <TableChart sx={{ fontSize: 18 }} />;
      default:
        return <Storage sx={{ fontSize: 18 }} />;
    }
  };

  const getLayerColor = (layer: string) => {
    switch (layer) {
      case 'bronze':
        return { bg: colors.layerBronze.bg, border: colors.layerBronze.border, text: colors.layerBronze.text, accent: colors.layerBronze.accent };
      case 'silver':
        return { bg: colors.layerSilver.bg, border: colors.layerSilver.border, text: colors.layerSilver.text, accent: colors.layerSilver.accent };
      case 'gold':
        return { bg: colors.layerGold.bg, border: colors.layerGold.border, text: colors.layerGold.text, accent: colors.layerGold.accent };
      default:
        return { bg: colors.accentLight, border: colors.textSecondary, text: colors.textMuted, accent: colors.textSecondary };
    }
  };

  const getNodeStatus = (node: DAGNode): string => {
    // Find matching ETL jobs for this node
    const nodeJobs = etlJobs.filter((job: ETLJob) => {
      const jobName = job.job_name?.toLowerCase() || '';
      const nodeLabel = node.label?.toLowerCase() || '';
      return jobName.includes(nodeLabel) || nodeLabel.includes(jobName) || 
             (job.table && nodeLabel.includes(job.table.toLowerCase()));
    });

    if (nodeJobs.length === 0) {
      return 'healthy'; // Default to healthy if no jobs found
    }

    // Get the most recent job
    const recentJob = nodeJobs.sort((a, b) => {
      const timeA = new Date(a.started_at).getTime();
      const timeB = new Date(b.started_at).getTime();
      return timeB - timeA;
    })[0];

    // Determine status based on job status and duration
    if (recentJob.status === 'failed' || recentJob.status === 'error') {
      return 'failed';
    }

    if (recentJob.status === 'slow') {
      return 'slow';
    }

    // Check if duration is unusually long (anomaly detection)
    if (recentJob.completed_at && recentJob.started_at) {
      const duration = (new Date(recentJob.completed_at).getTime() - new Date(recentJob.started_at).getTime()) / 1000;
      const avgDuration = nodeJobs
        .filter(j => j.completed_at && j.started_at)
        .map(j => (new Date(j.completed_at!).getTime() - new Date(j.started_at).getTime()) / 1000)
        .reduce((a, b, _, arr) => a + b / arr.length, 0);
      
      if (duration > avgDuration * 1.5 && avgDuration > 0) {
        return 'anomaly';
      }
    }

    return recentJob.status === 'completed' ? 'healthy' : 'healthy';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return colors.success;
      case 'slow':
        return colors.warning;
      case 'failed':
        return colors.error;
      case 'anomaly':
        return colors.error;
      default:
        return colors.success;
    }
  };

  const getStatusDot = (status: string) => {
    const color = getStatusColor(status);
    return (
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 0 2px ${color}20`,
        }}
      />
    );
  };

  // Get real metrics from ETL jobs for hover tooltip
  const getNodeMetrics = (node: DAGNode) => {
    const nodeLabel = node.label?.toLowerCase() || '';

    // Prefer direct matches on job/table name
    let nodeJobs = etlJobs.filter((job: ETLJob) => {
      const jobName = job.job_name?.toLowerCase() || '';
      const tableName = job.table?.toLowerCase() || '';
      return (
        jobName.includes(nodeLabel) ||
        nodeLabel.includes(jobName) ||
        (tableName && (nodeLabel.includes(tableName) || tableName.includes(nodeLabel)))
      );
    });

    // Fallback: if nothing matched by name, use jobs from the same layer
    if (nodeJobs.length === 0) {
      nodeJobs = etlJobs.filter((job: ETLJob) => job.layer?.toLowerCase() === node.layer?.toLowerCase());
    }

    if (nodeJobs.length === 0) {
      return {
        lastRunDuration: null,
        medianDuration: null,
        rowsProcessed: 0,
      };
    }

    // Helper to get "rows processed" from multiple possible fields
    const getRowsProcessed = (job: ETLJob & { rows_processed?: number; row_count?: number }) => {
      return (
        job.records_processed ??
        job.rows_processed ??
        job.row_count ??
        0
      );
    };

    // Prefer explicit duration field if backend provides it
    const getJobDurationSeconds = (job: ETLJob & { duration_seconds?: number }) => {
      if (typeof job.duration_seconds === 'number' && !Number.isNaN(job.duration_seconds)) {
        return job.duration_seconds;
      }
      if (job.completed_at && job.started_at) {
        const start = new Date(job.started_at).getTime();
        const end = new Date(job.completed_at).getTime();
        if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
          return Math.round((end - start) / 1000);
        }
      }
      return null;
    };

    const completedWithDuration = nodeJobs
      .map((job) => ({ job, duration: getJobDurationSeconds(job as any) }))
      .filter((item) => item.duration !== null) as { job: ETLJob; duration: number }[];

    if (completedWithDuration.length === 0) {
      return {
        lastRunDuration: null,
        medianDuration: null,
        rowsProcessed: nodeJobs.reduce((sum, job) => sum + getRowsProcessed(job as any), 0),
      };
    }

    // Last run = most recent completed job
    const sortedByTime = [...completedWithDuration].sort((a, b) => {
      const timeA = a.job.completed_at ? new Date(a.job.completed_at).getTime() : 0;
      const timeB = b.job.completed_at ? new Date(b.job.completed_at).getTime() : 0;
      return timeB - timeA;
    });
    const lastRunDuration = sortedByTime[0]?.duration ?? null;

    // Median duration across matched jobs
    const durations = completedWithDuration.map((d) => d.duration).sort((a, b) => a - b);
    const medianDuration =
      durations.length > 0 ? durations[Math.floor(durations.length / 2)] : null;

    // Sum rows processed across all matched jobs
    const rowsProcessed = nodeJobs.reduce(
      (sum, job) => sum + getRowsProcessed(job as any),
      0
    );

    return {
      lastRunDuration,
      medianDuration,
      rowsProcessed,
    };
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '—';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  };

  // Organize nodes by layer
  const layerGroups = {
    bronze: nodes.filter(n => n.layer === 'bronze'),
    silver: nodes.filter(n => n.layer === 'silver'),
    gold: nodes.filter(n => n.layer === 'gold'),
  };

  if (loading) {
    return (
      <Card elevation={0} sx={{ background: colors.paper, border: `1px solid ${colors.border}`, borderRadius: 2 }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>Loading pipeline lineage...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={0} sx={{ background: colors.paper, border: `1px solid ${colors.border}`, borderRadius: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            color: colors.text,
            fontSize: '1rem',
            mb: 3,
          }}
        >
          ETL Lineage Visualization
        </Typography>

        {/* Horizontal Swimlanes */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(['bronze', 'silver', 'gold'] as const).map((layer, layerIndex) => {
            const layerColor = getLayerColor(layer);
            const layerNodes = layerGroups[layer];

            return (
              <Box key={layer}>
                {/* Layer Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Chip
                    label={layer.charAt(0).toUpperCase() + layer.slice(1)}
                    size="small"
                    sx={{
                      backgroundColor: layerColor.bg,
                      color: layerColor.text,
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      height: '24px',
                      minWidth: '80px',
                      mr: 2,
                      border: `1px solid ${layerColor.border}`,
                    }}
                  />
                  <Box
                    sx={{
                      flex: 1,
                      height: '1px',
                      background: layerColor.border,
                      opacity: 0.3,
                    }}
                  />
                  {layerIndex < 2 && (
                    <ArrowForward sx={{ fontSize: 20, color: layerColor.accent, ml: 2, opacity: 0.6 }} />
                  )}
                </Box>

                {/* Nodes in Horizontal Flow */}
                {layerNodes.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center', color: colors.textMuted, fontSize: '0.875rem' }}>
                    No pipelines in {layer} layer
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    {layerNodes.map((node) => {
                      const status = getNodeStatus(node);
                      const metrics = getNodeMetrics(node);
                      return (
                        <Tooltip
                          key={node.id}
                          title={
                            <Box sx={{ p: 1 }}>
                              <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, mb: 1, fontSize: '0.8125rem' }}>
                                {node.label}
                              </Typography>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                <Box>
                                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem', opacity: 0.8, mb: 0.25 }}>
                                    Last run duration
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.75rem', fontWeight: 500 }}>
                                    {formatDuration(metrics.lastRunDuration)}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem', opacity: 0.8, mb: 0.25 }}>
                                    Median duration
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.75rem', fontWeight: 500 }}>
                                    {formatDuration(metrics.medianDuration)}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem', opacity: 0.8, mb: 0.25 }}>
                                    Rows processed
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.75rem', fontWeight: 500 }}>
                                    {metrics.rowsProcessed.toLocaleString()}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          }
                          arrow
                        >
                          <Paper
                            elevation={0}
                            sx={{
                              p: 2,
                              minWidth: '140px',
                              background: colors.paper,
                              border: `0.5px solid ${layerColor.border}80`,
                              borderRadius: 1.5,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              position: 'relative',
                              '&:hover': {
                                borderColor: layerColor.accent,
                                boxShadow: `0 2px 8px ${layerColor.accent}20`,
                                transform: 'translateY(-2px)',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.25 }}>
                              <Box
                                sx={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 1,
                                  background: layerColor.bg,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: layerColor.accent,
                                }}
                              >
                                {getNodeIcon(node.type)}
                              </Box>
                              {getStatusDot(status)}
                            </Box>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: colors.text,
                                fontSize: '0.8125rem',
                                mb: 0.75,
                                lineHeight: 1.3,
                              }}
                            >
                              {node.label}
                            </Typography>
                            <Chip
                              label={node.type}
                              size="small"
                              sx={{
                                backgroundColor: colors.background,
                                color: colors.textSecondary,
                                fontWeight: 500,
                                fontSize: '0.6875rem',
                                height: '18px',
                                border: 'none',
                              }}
                            />
                          </Paper>
                        </Tooltip>
                      );
                    })}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
};



