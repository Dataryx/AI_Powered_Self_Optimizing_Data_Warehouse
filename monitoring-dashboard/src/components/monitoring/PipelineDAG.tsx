/**
 * Pipeline DAG Visualization Component
 * Visual representation of ETL pipeline with modern design
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Grid, Paper, Chip } from '@mui/material';
import { ArrowForward, DataObject, Storage, TableChart, Transform } from '@mui/icons-material';
import { apiService } from '../../services/api';

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

export const PipelineDAG: React.FC<PipelineDAGProps> = ({ refreshKey = 0 }) => {
  const [nodes, setNodes] = useState<DAGNode[]>([]);
  const [edges, setEdges] = useState<DAGEdge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDAG();
    // DAG structure doesn't change frequently, refresh every 60 seconds
    const interval = setInterval(fetchDAG, 60000);
    return () => clearInterval(interval);
  }, [refreshKey]); // Re-run when refreshKey changes

  const fetchDAG = async () => {
    try {
      const data = await apiService.getPipelineDAG();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching pipeline DAG:', err);
      setLoading(false);
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'source':
        return <Storage sx={{ fontSize: 24 }} />;
      case 'transform':
        return <Transform sx={{ fontSize: 24 }} />;
      case 'aggregate':
        return <DataObject sx={{ fontSize: 24 }} />;
      case 'table':
        return <TableChart sx={{ fontSize: 24 }} />;
      default:
        return <Storage sx={{ fontSize: 24 }} />;
    }
  };

  const getLayerColor = (layer: string) => {
    switch (layer) {
      case 'bronze':
        return { bg: '#f59e0b', light: '#fef3c7', text: '#92400e' };
      case 'silver':
        return { bg: '#6366f1', light: '#e0e7ff', text: '#312e81' };
      case 'gold':
        return { bg: '#10b981', light: '#d1fae5', text: '#065f46' };
      default:
        return { bg: '#64748b', light: '#f1f5f9', text: '#334155' };
    }
  };

  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case 'source':
        return '#6366f1';
      case 'transform':
        return '#8b5cf6';
      case 'aggregate':
        return '#ec4899';
      case 'table':
        return '#64748b';
      default:
        return '#64748b';
    }
  };

  // Organize nodes by layer
  const layerGroups = {
    bronze: nodes.filter(n => n.layer === 'bronze'),
    silver: nodes.filter(n => n.layer === 'silver'),
    gold: nodes.filter(n => n.layer === 'gold'),
  };

  if (loading) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading pipeline DAG...</Typography>
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
          Pipeline DAG Visualization
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}>
          {(['bronze', 'silver', 'gold'] as const).map((layer, layerIndex) => {
            const layerColor = getLayerColor(layer);
            const layerNodes = layerGroups[layer];

            if (layerNodes.length === 0) return null;

            return (
              <Box key={layer}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Chip
                    label={layer.toUpperCase()}
                    sx={{
                      backgroundColor: layerColor.bg,
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      height: '28px',
                      mr: 2,
                    }}
                  />
                  <Box
                    sx={{
                      flex: 1,
                      height: '2px',
                      background: `linear-gradient(90deg, ${layerColor.bg} 0%, transparent 100%)`,
                    }}
                  />
                  {layerIndex < 2 && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${layerColor.bg} 0%, ${layerColor.bg}80 100%)`,
                        color: 'white',
                        ml: 2,
                      }}
                    >
                      <ArrowForward />
                    </Box>
                  )}
                </Box>

                <Grid container spacing={2}>
                  {layerNodes.map((node) => {
                    const typeColor = getNodeTypeColor(node.type);
                    return (
                      <Grid item xs={6} sm={4} md={3} key={node.id}>
                        <Paper
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            background: `linear-gradient(135deg, ${typeColor}10 0%, rgba(255,255,255,0.9) 100%)`,
                            border: `2px solid ${typeColor}40`,
                            transition: 'all 0.3s',
                            position: 'relative',
                            '&:hover': {
                              transform: 'translateY(-4px) scale(1.02)',
                              boxShadow: `0 8px 20px ${typeColor}40`,
                              borderColor: typeColor,
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                backgroundColor: `${typeColor}20`,
                                color: typeColor,
                                mb: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {getNodeIcon(node.type)}
                            </Box>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 700,
                                color: 'text.primary',
                                fontSize: '0.85rem',
                                mb: 0.5,
                              }}
                            >
                              {node.label}
                            </Typography>
                            <Chip
                              label={node.type}
                              size="small"
                              sx={{
                                backgroundColor: `${typeColor}15`,
                                color: typeColor,
                                fontWeight: 600,
                                fontSize: '0.65rem',
                                height: '18px',
                              }}
                            />
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            );
          })}
        </Box>

        {/* Legend */}
        <Box sx={{ mt: 3, p: 2, borderRadius: 2, backgroundColor: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1, display: 'block' }}>
            Node Types:
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {['source', 'transform', 'aggregate', 'table'].map((type) => {
              const typeColor = getNodeTypeColor(type);
              return (
                <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: typeColor }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                    {type}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

