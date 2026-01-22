/**
 * Header Component
 * Top navigation bar with status indicators
 */

import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Box, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    // Update time every second
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/dashboard', { replace: true });
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 6px rgba(0, 0, 0, 0.03)',
        borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
      }}
    >
      <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
        <Typography
          variant="h6"
          component="div"
          sx={{
            cursor: 'pointer',
            flexGrow: 0,
            mr: 4,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.01em',
            transition: 'transform 0.2s',
            '&:hover': {
              transform: 'scale(1.05)',
            },
          }}
          onClick={handleLogoClick}
        >
          Data Warehouse Monitor
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          label="API Connected"
          size="small"
          sx={{
            mr: 2,
            backgroundColor: '#10b981',
            color: 'white',
            fontWeight: 600,
            '& .MuiChip-label': {
              px: 1.5,
            },
          }}
        />
        <Box
          sx={{
            px: 2,
            py: 0.5,
            borderRadius: 2,
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {currentTime}
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  );
};




