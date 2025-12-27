import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { theme } from './styles/theme';
import DashboardPage from './pages/DashboardPage';
import OptimizationsPage from './pages/OptimizationsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
              background: '#0a0a0f',
              backgroundImage: 
                'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.1) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(236, 72, 153, 0.1) 0px, transparent 50%)',
              backgroundAttachment: 'fixed',
              }}
            >
              <Header />
              <Box sx={{ display: 'flex', flex: 1, mt: '64px' }}>
                <Sidebar />
                <Box
                  component="main"
                  sx={{
                    flexGrow: 1,
                    p: 4,
                    ml: { sm: '280px' },
                    minHeight: 'calc(100vh - 64px)',
                    width: { sm: 'calc(100% - 280px)' },
                    maxWidth: { sm: 'calc(100% - 280px)' },
                    boxSizing: 'border-box',
                    overflowX: 'hidden',
                  }}
                  className="fade-in"
                >
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/optimizations" element={<OptimizationsPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/alerts" element={<AlertsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Routes>
                </Box>
              </Box>
            </Box>
          </Router>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
