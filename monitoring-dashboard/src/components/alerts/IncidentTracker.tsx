/**
 * Incident Tracker Component
 * Displays system incidents and their status
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip,
  IconButton,
  Pagination,
} from '@mui/material';
import { Refresh, ReportProblem, CheckCircle, Schedule, Error as ErrorIcon } from '@mui/icons-material';
import { keyframes } from '@mui/material/styles';
import { apiService } from '../../services/api';

interface Incident {
  incident_id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
  resolved_at?: string;
}

interface IncidentTrackerProps {
  refreshKey?: number;
}

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const ITEMS_PER_PAGE = 5;

export const IncidentTracker: React.FC<IncidentTrackerProps> = ({ refreshKey = 0 }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(1);

  const fetchIncidents = useCallback(async () => {
    try {
      const data = await apiService.getIncidents();
      const incidentsList = data.incidents || data || [];
      setIncidents(incidentsList);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching incidents:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, [fetchIncidents, refreshKey]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
        return { bg: '#10b981', light: '#10b98120', border: '#10b98140', icon: CheckCircle };
      case 'active':
        return { bg: '#ef4444', light: '#ef444420', border: '#ef444440', icon: ErrorIcon };
      case 'investigating':
        return { bg: '#f59e0b', light: '#f59e0b20', border: '#f59e0b40', icon: Schedule };
      default:
        return { bg: '#64748b', light: '#64748b20', border: '#64748b40', icon: ReportProblem };
    }
  };

  const totalPages = Math.ceil(incidents.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentIncidents = incidents.slice(startIndex, endIndex);

  const activeCount = incidents.filter(i => i.status?.toLowerCase() === 'active').length;
  const resolvedCount = incidents.filter(i => i.status?.toLowerCase() === 'resolved').length;

  if (loading && incidents.length === 0) {
    return (
      <Card sx={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)' }}>
        <CardContent sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading incidents...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        maxHeight: '600px',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
        },
      }}
    >
      <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ReportProblem sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
                Incident Tracker
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                System incidents and status
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {activeCount > 0 && (
              <Chip
                label={activeCount}
                size="small"
                sx={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: '20px',
                }}
              />
            )}
            {resolvedCount > 0 && (
              <Chip
                label={resolvedCount}
                size="small"
                sx={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: '20px',
                }}
              />
            )}
            <IconButton
              onClick={fetchIncidents}
              size="small"
              sx={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6',
                '&:hover': {
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  transform: 'rotate(180deg)',
                },
                transition: 'all 0.3s',
                width: 28,
                height: 28,
              }}
            >
              <Refresh sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Incidents List */}
        {incidents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box>
              <CheckCircle sx={{ fontSize: 48, color: '#10b981', opacity: 0.5, mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                No Active Incidents
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, overflowY: 'auto', pb: 0.5 }}>
              {currentIncidents.map((incident, index) => {
                const statusColors = getStatusColor(incident.status);
                const StatusIcon = statusColors.icon;

                return (
                  <Box
                    key={incident.incident_id || index}
                    sx={{
                      p: 1.25,
                      mb: 1,
                      borderRadius: 1.5,
                      border: `1px solid ${statusColors.border}`,
                      background: statusColors.light,
                      animation: `${slideIn} 0.3s ease-out`,
                      animationDelay: `${index * 0.05}s`,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1 }}>
                        <StatusIcon sx={{ fontSize: 16, color: statusColors.bg }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {incident.title}
                        </Typography>
                      </Box>
                      <Chip
                        label={incident.status}
                        size="small"
                        sx={{
                          height: '18px',
                          fontSize: '0.65rem',
                          backgroundColor: statusColors.bg,
                          color: 'white',
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                      {incident.description}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                      Created: {new Date(incident.created_at).toLocaleString()}
                      {incident.resolved_at && ` • Resolved: ${new Date(incident.resolved_at).toLocaleString()}`}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Pagination */}
            {totalPages > 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  p: 1,
                  background: 'linear-gradient(to top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.8) 100%)',
                  backdropFilter: 'blur(10px)',
                  borderTop: '1px solid rgba(59, 130, 246, 0.1)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(e, value) => setCurrentPage(value)}
                  size="small"
                  siblingCount={0}
                  boundaryCount={1}
                />
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

