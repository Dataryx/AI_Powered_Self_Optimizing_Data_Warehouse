import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSystemActivityLogger } from './hooks/useSystemActivityLogger';

/**
 * Route-level code splitting: visiting "/" only downloads the Dashboard chunk, not Monitoring /
 * Data Explorer / Analytics / etc. (Those pages only run their hooks after you navigate there.)
 */
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const DataExplorerPage = lazy(() => import('./pages/DataExplorerPage'));
const OptimizationsPage = lazy(() => import('./pages/OptimizationsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#0c0f1a] flex items-center justify-center">
      <span className="font-mono text-sm text-[#5a6a8a]">Loading…</span>
    </div>
  );
}

function ActivityLoggerBridge() {
  useSystemActivityLogger();
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ActivityLoggerBridge />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/storage" element={<Navigate to="/" replace />} />
          <Route path="/data-explorer" element={<DataExplorerPage />} />
          <Route path="/optimizations" element={<OptimizationsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
