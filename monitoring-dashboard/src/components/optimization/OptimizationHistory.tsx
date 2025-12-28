import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

export interface OptimizationHistoryItem {
  id: string;
  type: 'index' | 'partition' | 'cache';
  table: string;
  status: 'applied' | 'failed' | 'rolled_back';
  appliedAt: string;
  improvementPercent: number;
  description: string;
}

interface OptimizationHistoryProps {
  history: OptimizationHistoryItem[];
}

const typeConfig = {
  index: { icon: <StorageIcon />, label: 'Index', color: 'rgba(255, 255, 255, 0.8)' },
  partition: { icon: <SpeedIcon />, label: 'Partition', color: 'rgba(255, 255, 255, 0.8)' },
  cache: { icon: <MemoryIcon />, label: 'Cache', color: 'rgba(255, 255, 255, 0.8)' },
};

const statusConfig = {
  applied: {
    icon: <CheckCircleIcon />,
    color: 'rgba(148, 163, 184, 0.9)',
    label: 'Applied',
    bgColor: 'rgba(148, 163, 184, 0.15)',
  },
  failed: {
    icon: <ErrorIcon />,
    color: 'rgba(239, 68, 68, 0.8)',
    label: 'Failed',
    bgColor: 'rgba(239, 68, 68, 0.15)',
  },
  rolled_back: {
    icon: <ErrorIcon />,
    color: 'rgba(255, 255, 255, 0.7)',
    label: 'Rolled Back',
    bgColor: 'rgba(255, 255, 255, 0.1)',
  },
};

export const OptimizationHistory: React.FC<OptimizationHistoryProps> = ({ history }) => {
  if (history.length === 0) {
    return (
      <Card
        sx={{
          background: 'rgba(17, 17, 26, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#ffffff' }}>
            Optimization History
          </Typography>
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <Typography variant="body2">No optimization history available</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'rgba(17, 17, 26, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#ffffff', fontSize: '1.25rem' }}>
          Optimization History
        </Typography>
        <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 600, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                  Type
                </TableCell>
                <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 600, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                  Table
                </TableCell>
                <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 600, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                  Status
                </TableCell>
                <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 600, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                  Improvement
                </TableCell>
                <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 600, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                  Applied At
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((item) => {
                const type = typeConfig[item.type];
                const status = statusConfig[item.status];
                return (
                  <TableRow
                    key={item.id}
                    sx={{
                      '&:hover': {
                        background: 'rgba(255, 255, 255, 0.05)',
                      },
                      '& .MuiTableCell-root': {
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1,
                            background: 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(255, 255, 255, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                          }}
                        >
                          {type.icon}
                        </Box>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                          {type.label}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                      {item.table}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={status.icon}
                        label={status.label}
                        size="small"
                        sx={{
                          background: status.bgColor,
                          color: status.color,
                          fontWeight: 500,
                          fontSize: '0.75rem',
                          border: `1px solid ${status.color}30`,
                          '& .MuiChip-icon': {
                            color: 'inherit',
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingUpIcon sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.7)' }} />
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                          {item.improvementPercent.toFixed(1)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                      {new Date(item.appliedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

