/**
 * Main App Component
 * Root component with routing and layout.
 */

import React from 'react'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './store';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { DashboardPage } from './pages/DashboardPage';
import { MonitoringDashboard } from './pages/MonitoringDashboard';
import { StorageDashboard } from './pages/StorageDashboard';
import { OptimizationsPage } from './pages/OptimizationsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AlertsIncidentsPage } from './pages/AlertsIncidentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DataExplorerPage } from './pages/DataExplorerPage';
import { Box } from '@mui/material';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 30000, // Consider data fresh for 30 seconds
    },
  },
});

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6366f1', // Indigo
      light: '#818cf8',
      dark: '#4f46e5',
    },
    secondary: {
      main: '#ec4899', // Pink
      light: '#f472b6',
      dark: '#db2777',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 16,
  },
  shadows: [
    'none',
    '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
    '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    '0 10px 15px -3px rgba(0, 0, 0, 0.08)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
  ] as any,
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 24px',
        },
      },
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Box sx={{ display: 'flex', minHeight: '100vh' }}>
                <Header />
                <Sidebar />
                <Box
                  component="main"
                  sx={{
                    flexGrow: 1,
                    p: 0,
                    mt: 8,
                    ml: { sm: '70px' },
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    minHeight: 'calc(100vh - 64px)',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '200px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      opacity: 0.03,
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
      </Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;


