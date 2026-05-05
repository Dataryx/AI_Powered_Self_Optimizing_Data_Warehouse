import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SidebarPageShell from '../components/SidebarPageShell';
import MonitoringHeader from '../components/monitoring/MonitoringHeader';
import ETLStats from '../components/monitoring/ETLStats';
import LineageVisualization from '../components/monitoring/LineageVisualization';
import RecentETLRuns from '../components/monitoring/RecentETLRuns';
import ManualETLJobRunner from '../components/monitoring/ManualETLJobRunner';
import DataFreshness from '../components/monitoring/DataFreshness';
import DataQuality from '../components/monitoring/DataQuality';
import { motion } from 'framer-motion';
import { Satellite } from 'lucide-react';
import { useMonitoringData } from '../hooks/useMonitoringData';

export default function MonitoringPage() {
  const { data, loading, refreshing, error, refetch } = useMonitoringData();
  const location = useLocation();

  useEffect(() => {
    const id = location.hash.replace(/^#/, '');
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => clearTimeout(t);
  }, [location.hash, location.pathname, loading]);

  return (
    <SidebarPageShell className="bg-[#0a0d18]">
      <MonitoringHeader refreshing={refreshing} />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 max-w-7xl mx-auto w-full relative">
          {/* Ambient background */}
          <div className="fixed inset-0 pointer-events-none z-0" style={{
            background: 'radial-gradient(ellipse 800px 600px at 30% 20%, rgba(62,207,255,0.03) 0%, transparent 70%), radial-gradient(ellipse 600px 500px at 80% 70%, rgba(167,139,250,0.02) 0%, transparent 70%)'
          }} />

          <div className="relative z-10">
            {/* Page title */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-[#3ecfff12] border border-[#3ecfff25] flex items-center justify-center shrink-0">
                  <Satellite size={16} className="text-[#3ecfff]" />
                </div>
                <h1 className="font-body text-2xl sm:text-3xl font-bold text-[#e0e8f5] tracking-tight">ETL Monitoring</h1>
              </div>
              <p className="font-body text-sm text-[#5a6a8a] ml-0 sm:ml-11 mt-1 sm:mt-0">Real-time pipeline health and data freshness</p>
            </motion.div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono">
                {error} —{' '}
                <button type="button" onClick={() => void refetch()} className="underline">
                  Retry
                </button>
              </div>
            )}
            {/* Stats row */}
            <ETLStats data={data} loading={loading} />

            {/* Lineage */}
            <div id="monitoring-lineage" className="mt-6 scroll-mt-24">
              <LineageVisualization data={data} loading={loading} />
            </div>

            {/* Recent ETL Runs + Throughput */}
            <div id="monitoring-etl" className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6 scroll-mt-24">
              <RecentETLRuns data={data} loading={loading} onRefetch={refetch} />
              <ManualETLJobRunner
                jobs={data.jobs}
                jobsLoading={loading}
                jobDefinitions={data.jobDefinitions}
                definitionsLoading={loading}
                onAfterDispatch={refetch}
              />
            </div>

            {/* Data Freshness & SLA */}
            <div id="monitoring-freshness" className="mt-6 scroll-mt-24">
              <DataFreshness
                data={data}
                loading={loading || data.freshness === undefined}
                onRefetch={refetch}
              />
            </div>

            {/* Data Quality */}
            <div id="monitoring-data-quality" className="mt-6 scroll-mt-24">
              <DataQuality
                data={data}
                loading={loading || data.dataQuality === undefined}
                onRefetch={refetch}
              />
            </div>
          </div>
        </main>
    </SidebarPageShell>
  );
}
