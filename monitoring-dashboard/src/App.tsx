/**
 * Main App Component
 * Root component with routing and layout. Supports light/dark mode.
 */

import React, { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './store';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ApiStatusProvider } from './contexts/ApiStatusContext';
import { ColorModeProvider, useColorMode } from './contexts/ColorModeContext';
import { getTheme } from './theme/theme';
import { DashboardPage } from './pages/DashboardPage';
import { MonitoringDashboard } from './pages/MonitoringDashboard';
import { StorageDashboard } from './pages/StorageDashboard';
import { OptimizationsPage } from './pages/OptimizationsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AlertsIncidentsPage } from './pages/AlertsIncidentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DataExplorerPage } from './pages/DataExplorerPage';
import { Box } from '@mui/material';
import { useThemeColors } from './theme/useThemeColors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

function AppLayout() {
  const { mode } = useColorMode();
  const colors = useThemeColors();
  const theme = useMemo(() => getTheme(mode), [mode]);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? saved === 'true' : true;
  });

  const handleSidebarToggle = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarOpen', String(next));
      return next;
    });
  };

  const isDark = mode === 'dark';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
          <Header sidebarOpen={sidebarOpen} onSidebarToggle={handleSidebarToggle} />
          <Sidebar open={sidebarOpen} onToggle={handleSidebarToggle} />
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: 0,
              mt: 10,
              ml: sidebarOpen ? '260px' : '72px',
              bgcolor: 'background.default',
              minHeight: 'calc(100vh - 80px)',
              position: 'relative',
              transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '200px',
                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                opacity: isDark ? 0.06 : 0.04,
                pointerEvents: 'none',
              },
            }}
          >
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/monitoring" element={<MonitoringDashboard />} />
              <Route path="/storage" element={<StorageDashboard />} />
              <Route path="/data" element={<DataExplorerPage />} />
              <Route path="/optimizations" element={<OptimizationsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/alerts" element={<AlertsIncidentsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <ApiStatusProvider>
            <ColorModeProvider>
              <AppLayout />
            </ColorModeProvider>
          </ApiStatusProvider>
        </Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
