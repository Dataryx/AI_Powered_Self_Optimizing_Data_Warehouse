import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import type { DashboardData } from '../hooks/useDashboardData';

const FALLBACK_ALERTS = [
  { type: 'warning', icon: AlertTriangle, msg: 'Bronze layer ingestion delayed by 12 min', time: '5 min ago', color: '#f59e0b' },
  { type: 'success', icon: CheckCircle, msg: 'Gold layer refresh completed successfully', time: '18 min ago', color: '#34d399' },
  { type: 'info', icon: Info, msg: 'New table added to Silver layer', time: '1 hr ago', color: '#3ecfff' },
  { type: 'error', icon: XCircle, msg: 'Failed to sync 3 records in customer_dim', time: '2 hr ago', color: '#f87171' },
];

function formatTimeAgo(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} min ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h} hr ago`;
    const day = Math.floor(h / 24);
    return `${day} day${day > 1 ? 's' : ''} ago`;
  } catch {
    return '';
  }
}

function severityColor(s: string): string {
  const lower = (s ?? '').toLowerCase();
  if (lower === 'critical' || lower === 'error' || lower === 'high') return '#f87171';
  if (lower === 'warning' || lower === 'medium') return '#f59e0b';
  if (lower === 'success' || lower === 'info' || lower === 'low') return '#34d399';
  return '#3ecfff';
}

function severityIcon(s: string): typeof AlertTriangle {
  const lower = (s ?? '').toLowerCase();
  if (lower === 'critical' || lower === 'error' || lower === 'high') return XCircle;
  if (lower === 'warning' || lower === 'medium') return AlertTriangle;
  if (lower === 'success') return CheckCircle;
  return Info;
}

function normalizeAlerts(data: DashboardData | null): Array<{ type: string; icon: typeof AlertTriangle; msg: string; time: string; color: string }> {
  const raw = data?.alerts?.alerts;
  if (!Array.isArray(raw) || raw.length === 0) return FALLBACK_ALERTS;
  return raw.slice(0, 8).map((a) => {
    const severity = a.severity ?? a.type ?? 'info';
    return {
      type: severity,
      icon: severityIcon(severity),
      msg: (a.message ?? a.title ?? 'Alert').toString(),
      time: a.timestamp ? formatTimeAgo(a.timestamp) : '—',
      color: severityColor(severity),
    };
  });
}

interface AlertsPanelProps {
  data?: DashboardData | null;
  loading?: boolean;
}

export default function AlertsPanel({ data = null, loading = false }: AlertsPanelProps) {
  const alerts = useMemo(() => normalizeAlerts(data ?? null), [data]);

  return (
    <div className="bg-[#111628] rounded-2xl border border-[#1e2540] overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-0.5"><span className="font-mono text-[9px] text-[#3a4a6a] tracking-[0.3em] uppercase">Section 05</span><span className="font-body text-sm font-semibold text-[#a0b0cc]">Recent Alerts</span></div>
        <p className="font-mono text-[10px] text-[#4a5a7a] tracking-wider">System notifications and events</p>
      </div>
      {loading && !data?.alerts?.alerts?.length && (
        <div className="px-5 pb-5 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-[#0c0f1a] rounded-xl border border-[#1e2540] animate-pulse" />
          ))}
        </div>
      )}
      {(!loading || (data?.alerts?.alerts?.length ?? 0) > 0) && (
        <div className="px-5 pb-5 space-y-2">
          {alerts.map((a, i) => {
            const Icon = a.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 + 0.2 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-[#0c0f1a] border border-[#1e2540] border-l-[3px] hover:border-[#2a3a60] transition-colors cursor-pointer group"
                style={{ borderLeftColor: `${a.color}60` }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${a.color}12` }}>
                  <Icon size={13} style={{ color: a.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm text-[#c0cde0] leading-snug group-hover:text-[#e0e8f5] transition-colors">{a.msg}</p>
                  <span className="font-mono text-[10px] text-[#3a4a6a] mt-1 block">{a.time}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
