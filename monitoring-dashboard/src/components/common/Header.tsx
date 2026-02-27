/**
 * Header – floating glass bar with breadcrumb, live status, and dark mode toggle.
 */

import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Box, IconButton, Tooltip, alpha, useTheme } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useColorMode } from '../../contexts/ColorModeContext';
import { useThemeColors } from '../../theme/useThemeColors';

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/monitoring': 'Monitoring',
  '/storage': 'Storage & Resources',
  '/data': 'Data Explorer',
  '/optimizations': 'Optimizations',
  '/analytics': 'Analytics',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'Dashboard';
  return ROUTE_LABELS[pathname] ?? pathname.slice(1).replace(/-/g, ' ');
}

interface HeaderProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ sidebarOpen = true, onSidebarToggle }) => {
  const theme = useTheme();
  const colors = useThemeColors();
  const { mode, toggleColorMode } = useColorMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    const t = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const pageTitle = getPageTitle(location.pathname);
  const isDark = mode === 'dark';
  const bg = isDark ? alpha(theme.palette.background.paper, 0.85) : alpha('#fff', 0.82);
  const borderColor = isDark ? alpha('#fff', 0.08) : alpha(colors.text, 0.08);
  const shadowColor = isDark ? alpha('#000', 0.3) : alpha(colors.text, 0.06);

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        width: { xs: '100%', md: `calc(100% - ${sidebarOpen ? 260 : 72}px)` },
        ml: { xs: 0, md: sidebarOpen ? '260px' : '72px' },
        mt: 1.5,
        mx: { xs: 0, md: 1.5 },
        maxWidth: { md: `calc(100vw - ${sidebarOpen ? 260 : 72}px - 24px)` },
        borderRadius: { xs: 0, md: 3 },
        background: bg,
        backdropFilter: 'blur(20px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.1)',
        border: `1px solid ${borderColor}`,
        boxShadow: `0 4px 24px ${shadowColor}`,
        transition:
          'margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1), width 0.22s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s, border-color 0.2s',
      }}
    >
      <Toolbar sx={{ minHeight: 56, px: { xs: 2, sm: 2.5 } }}>
        <Tooltip title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
          <IconButton
            size="small"
            onClick={onSidebarToggle}
            sx={{
              mr: 1.5,
              color: 'text.secondary',
              backgroundColor: (t) => alpha(t.palette.text.primary, 0.04),
              '&:hover': {
                backgroundColor: alpha(colors.primary, 0.1),
                color: 'primary.main',
              },
              transition: 'all 0.2s',
            }}
          >
            {sidebarOpen ? (
              <ChevronRightIcon sx={{ transform: 'rotate(180deg)' }} />
            ) : (
              <MenuIcon />
            )}
          </IconButton>
        </Tooltip>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontWeight: 500,
              fontSize: '0.75rem',
              cursor: 'pointer',
              '&:hover': { color: 'primary.main' },
            }}
            onClick={() => navigate('/dashboard')}
          >
            Home
          </Typography>
          <ChevronRightIcon sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.7 }} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              fontSize: '1rem',
              letterSpacing: '-0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {pageTitle}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton
              size="small"
              onClick={toggleColorMode}
              sx={{
                color: 'text.secondary',
                backgroundColor: (t) => alpha(t.palette.text.primary, 0.04),
                '&:hover': {
                  backgroundColor: (t) => alpha(t.palette.primary.main, 0.12),
                  color: 'primary.main',
                },
                transition: 'all 0.2s',
              }}
            >
              {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.5,
              py: 0.6,
              borderRadius: 2,
              backgroundColor: alpha(colors.success, 0.1),
              border: `1px solid ${alpha(colors.success, 0.25)}`,
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: colors.success,
                boxShadow: `0 0 8px ${alpha(colors.success, 0.6)}`,
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.6 },
                },
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600, color: colors.success, fontSize: '0.7rem' }}>
              Live
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontWeight: 500,
              fontSize: '0.7rem',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {currentTime}
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
