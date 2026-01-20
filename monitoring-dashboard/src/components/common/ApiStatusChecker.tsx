/**
 * API Status Checker Component
 * Checks if API is accessible and displays connection status
 */

import React, { useEffect, useState } from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';
import { CheckCircle, Error as ErrorIcon, Warning } from '@mui/icons-material';
import { apiService } from '../../services/api';

export const ApiStatusChecker: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error' | 'offline'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkApiStatus();
    const interval = setInterval(checkApiStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkApiStatus = async () => {
    try {
      await apiService.getHealth();
      setStatus('connected');
      setError(null);
    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Unable to connect to API';
      setError(errorMessage);
    }
  };

  if (status === 'checking') {
    return null; // Don't show anything while checking
  }

  if (status === 'error') {
    return (
      <Alert 
        severity="error" 
        icon={<ErrorIcon />}
        sx={{ 
          mb: 2,
          borderRadius: 2,
          '& .MuiAlert-message': {
            width: '100%',
          },
        }}
      >
        <AlertTitle>API Connection Error</AlertTitle>
        <Box sx={{ mt: 1 }}>
          <strong>Unable to connect to the API server.</strong>
          <br />
          <Box component="span" sx={{ fontSize: '0.875rem' }}>
            {error || 'Please ensure the API server is running at http://localhost:8000'}
          </Box>
          <br />
          <Box component="span" sx={{ fontSize: '0.875rem', mt: 1, display: 'block' }}>
            To start the API server, run: <code>python start_services.py</code> or start the ML Optimization API manually.
          </Box>
        </Box>
      </Alert>
    );
  }

  if (status === 'connected') {
    return (
      <Alert 
        severity="success" 
        icon={<CheckCircle />}
        sx={{ 
          mb: 2,
          borderRadius: 2,
          display: 'none', // Hide when connected (optional - remove this line to always show)
        }}
      >
        <AlertTitle>API Connected</AlertTitle>
        Connected to the API server successfully.
      </Alert>
    );
  }

  return null;
};

