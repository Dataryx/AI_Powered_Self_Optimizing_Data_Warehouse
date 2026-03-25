import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import StorageHeader from '../components/storage/StorageHeader';
import StorageStats from '../components/storage/StorageStats';
import StorageUtilization from '../components/storage/StorageUtilization';
import DataGrowthTrends from '../components/storage/DataGrowthTrends';
import CompressionStats from '../components/storage/CompressionStats';
import CachePerformance from '../components/storage/CachePerformance';
import ResourceAllocation from '../components/storage/ResourceAllocation';
import CostTracking from '../components/storage/CostTracking';
import { useStorageData } from '../hooks/useStorageData';
import { formatLocalTime } from '../utils/time';

export default function StoragePage() {
  const { data, loading, error, refetch } = useStorageData();
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  return (
    <div className="min-h-screen bg-base topo-bg flex">
      <Sidebar />
      <div className="flex-1 ml-[240px] min-h-screen flex flex-col">
        <StorageHeader />
        <main className="flex-1 p-6 max-w-[1300px]">
          {/* Page title */}
          <div className="mb-2">
            <h1 className="font-body text-3xl font-bold text-ink tracking-tight">Storage & Resource Dashboard</h1>
            <p className="font-body text-sm text-ink-muted mt-1">Real-time storage utilization, growth trends, compression, cache performance, and cost tracking</p>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-topo-4/10 border border-topo-4/20">
              <div className="w-1.5 h-1.5 rounded-full bg-topo-4 animate-pulse" />
              <span className="font-mono text-[9px] text-topo-4 font-bold tracking-widest uppercase">Live</span>
            </div>
            <span className="font-mono text-[10px] text-ink-faint">Updated: {formatLocalTime(time)}</span>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-sm font-mono">
              {error} — <button type="button" onClick={refetch} className="underline">Retry</button>
            </div>
          )}

          {/* Stats row */}
          <StorageStats data={data} loading={loading} />

          {/* Storage Utilization */}
          <div className="mt-6">
            <StorageUtilization data={data} loading={loading} />
          </div>

          {/* Data Growth Trends */}
          <div className="mt-6">
            <DataGrowthTrends data={data} loading={loading} onRefetch={refetch} />
          </div>

          {/* Compression + Cache Performance */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
            <CompressionStats data={data} loading={loading} />
            <CachePerformance data={data} loading={loading} />
          </div>

          {/* Resource Allocation + Cost Tracking */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6 mb-10">
            <ResourceAllocation data={data} loading={loading} />
            <CostTracking data={data} loading={loading} />
          </div>
        </main>
      </div>
    </div>
  );
}
