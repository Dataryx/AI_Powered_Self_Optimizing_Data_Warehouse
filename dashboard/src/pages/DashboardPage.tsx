import TopBar from '../components/TopBar';
import HeroSection from '../components/HeroSection';
import MedallionTiers from '../components/MedallionTiers';
import KeyMetrics from '../components/KeyMetrics';
import SalesTrend from '../components/SalesTrend';
import TopProducts from '../components/TopProducts';
import Footer, { type FooterHealthInfo } from '../components/Footer';
import { useDashboardData, type DashboardData } from '../hooks/useDashboardData';

function footerHealthFromDashboard(data: DashboardData | null, loading: boolean): FooterHealthInfo {
  const h = data?.health as Record<string, unknown> | null | undefined;
  const healthy = data?.health != null;
  const pending = loading && !healthy;
  const uptime = h && h.uptime != null ? String(h.uptime) : '99.97%';
  const latency =
    h && h.latency_ms != null ? `< ${h.latency_ms} ms` : '< 2 ms';
  return {
    status: healthy ? 'Online' : 'Unknown',
    uptime,
    latency,
    healthy,
    pending,
  };
}

export default function DashboardPage() {
  const { data, loading, error, refetch } = useDashboardData();

  return (
    <div className="min-h-screen bg-base topo-bg">
      <TopBar data={data} loading={loading} connectionError={error} />
      <HeroSection />
      <main className="max-w-7xl mx-auto px-4 md:px-8 pb-20">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono">
            {error} — showing fallback data. <button type="button" onClick={refetch} className="underline ml-1">Retry</button>
          </div>
        )}
        <KeyMetrics data={data} loading={loading} />
        <MedallionTiers data={data} loading={loading} />
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mt-10 items-stretch">
          <div className="xl:col-span-3">
            <SalesTrend data={data} loading={loading} />
          </div>
          <div className="xl:col-span-2">
            <TopProducts data={data} loading={loading} />
          </div>
        </div>
      </main>
      <Footer health={footerHealthFromDashboard(data, loading)} />
    </div>
  );
}
