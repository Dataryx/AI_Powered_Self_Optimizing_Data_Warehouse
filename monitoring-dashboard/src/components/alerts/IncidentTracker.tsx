/**
 * Incident Tracker Component
 * Displays system incidents and their lifecycle status
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip,
  IconButton,
  Divider,
} from '@mui/material';
import { Refresh, ReportProblem, CheckCircle, Schedule, Error as ErrorIcon } from '@mui/icons-material';
import { apiService } from '../../services/api';

interface Incident {
  incident_id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
  resolved_at?: string;
  acknowledged_at?: string;
}

interface IncidentTrackerProps {
  refreshKey?: number;
}

export const IncidentTracker: React.FC<IncidentTrackerProps> = ({ refreshKey = 0 }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = useCallback(async () => {
    try {
      const data = await apiService.getIncidents();
      const incidentsList = data.incidents || data || [];
      setIncidents(Array.isArray(incidentsList) ? incidentsList : []);
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
        return { bg: '#10b981', light: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)', icon: CheckCircle };
      case 'acknowledged':
        return { bg: '#3b82f6', light: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', icon: Schedule };
      case 'detected':
      case 'active':
        return { bg: '#ef4444', light: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', icon: ErrorIcon };
      default:
        return { bg: '#64748b', light: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.2)', icon: ReportProblem };
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#3b82f6';
      default:
        return '#64748b';
    }
  };

  if (loading && incidents.length === 0) {
    return (
      <Card sx={{ boxShadow: 1, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Loading incidents...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ boxShadow: 1, border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 0.5 }}>
              Incident Tracker
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              Incident lifecycle: detected → acknowledged → resolved
            </Typography>
          </Box>
          <IconButton
            onClick={fetchIncidents}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover',
                transform: 'rotate(180deg)',
              },
              transition: 'all 0.3s',
            }}
          >
            <Refresh fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Incidents List or Empty State */}
        {incidents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircle sx={{ fontSize: 48, color: '#10b981', opacity: 0.3, mb: 1.5 }} />
            <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary', mb: 0.5 }}>
              No active incidents
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              All systems operational
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {incidents.slice(0, 5).map((incident) => {
              const statusColors = getStatusColor(incident.status);
              const StatusIcon = statusColors.icon;
              const severityColor = getSeverityColor(incident.severity);

              return (
                <Box
                  key={incident.incident_id}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: `1px solid ${statusColors.border}`,
                    backgroundColor: statusColors.light,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1 }}>
                      <StatusIcon sx={{ fontSize: 18, color: statusColors.bg, mt: 0.25 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.5 }}>
                          {incident.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                          {incident.description}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label={incident.status}
                      size="small"
                      sx={{
                        height: '20px',
                        fontSize: '0.7rem',
                        backgroundColor: statusColors.bg,
                        color: 'white',
                        fontWeight: 500,
                        ml: 1,
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                    <Chip
                      label={incident.severity}
                      size="small"
                      sx={{
                        height: '20px',
                        fontSize: '0.7rem',
                        backgroundColor: `${severityColor}15`,
                        color: severityColor,
                        fontWeight: 500,
                        border: `1px solid ${severityColor}30`,
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', ml: 'auto' }}>
                      Started: {new Date(incident.created_at).toLocaleString()}
                      {incident.resolved_at && ` • Resolved: ${new Date(incident.resolved_at).toLocaleString()}`}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
