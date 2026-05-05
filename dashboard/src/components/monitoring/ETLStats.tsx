import { motion } from 'framer-motion';
import { Zap, XCircle, Clock, Brain, ShieldCheck, type LucideIcon } from 'lucide-react';

type EtlStatRow = {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  badge?: string;
  sub?: string;
};

const defaultStats: EtlStatRow[] = [
  { label: 'Active Pipelines', value: '0', icon: Zap, color: '#3ecfff' },
  { label: 'Failed Runs (24h)', value: '0', icon: XCircle, color: '#f87171' },
  { label: 'Data Freshness SLA', value: '0/0', icon: ShieldCheck, color: '#34d399', badge: 'On time' },
  { label: 'Avg ETL Duration', value: '0s', icon: Clock, color: '#fbbf24', sub: '+0s vs baseline' },
  { label: 'ML-Detected Anomalies', value: '0', icon: Brain, color: '#a78bfa' },
];

function buildStats(data: any): EtlStatRow[] {
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  const active = jobs.filter((j: any) => j?.status === 'running' || j?.status === 'pending').length;
  const failed24h = Array.isArray(data?.errors) ? data.errors.length : 0;
  const freshness = data?.freshness;
  const slaMet = freshness?.sla_met ?? 0;
  const slaTotal = freshness?.sla_total ?? 0;
  const avgDur = data?.jobs?.length
    ? (jobs.reduce((s: number, j: any) => s + (j?.duration_seconds ?? 0), 0) / jobs.length).toFixed(0) + 's'
    : '0s';
  return [
    { label: 'Active Pipelines', value: String(active), icon: Zap, color: '#3ecfff' },
    { label: 'Failed Runs (24h)', value: String(failed24h), icon: XCircle, color: '#f87171' },
    { label: 'Data Freshness SLA', value: `${slaMet}/${slaTotal}`, icon: ShieldCheck, color: '#34d399', badge: slaTotal ? 'On time' : undefined },
    { label: 'Avg ETL Duration', value: avgDur, icon: Clock, color: '#fbbf24', sub: '+0s vs baseline' },
    { label: 'ML-Detected Anomalies', value: '0', icon: Brain, color: '#a78bfa' },
  ];
}

interface ETLStatsProps { data?: any; loading?: boolean }

export default function ETLStats({ data, loading }: ETLStatsProps) {
  const hasMetrics =
    data &&
    (data.jobs?.length ||
      data.errors?.length ||
      data.freshness ||
      (data.throughput && (data.throughput.overall_throughput != null || data.throughput.throughput?.length)));
  const stats = hasMetrics ? buildStats(data) : defaultStats;
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {(loading && !data?.jobs?.length && !data?.errors?.length) ? (
        [1, 2, 3, 4, 5].map((i) => <div key={i} className="bg-[#111628] rounded-2xl border border-[#1e2540] p-4 h-24 animate-pulse" />)
      ) : (
      stats.map((s, i) => {
        const Icon = s.icon;
        return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="relative bg-[#111628] rounded-2xl border border-[#1e2540] p-4 overflow-hidden group hover:border-[#2a3a60] transition-all"
          >
            {/* Glow accent */}
            <div className="absolute top-0 left-0 w-full h-[2px] opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${s.color}, transparent)` }} />
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} style={{ color: s.color }} />
              <span className="font-mono text-[8px] tracking-[0.2em] uppercase" style={{ color: `${s.color}88` }}>{s.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-body text-2xl font-bold text-[#e0e8f5]">{s.value}</span>
              {s.badge && (
                <span className="font-mono text-[8px] font-bold text-[#34d399] bg-[#0d3a2a] border border-[#1a5c40] px-1.5 py-0.5 rounded-md tracking-wider">
                  {s.badge}
                </span>
              )}
            </div>
            {s.sub && <span className="font-mono text-[9px] text-[#4a5a7a] mt-0.5 block">{s.sub}</span>}
          </motion.div>
        );
      }))}
    </div>
  );
}
