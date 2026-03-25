import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  Radio,
  Activity,
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Menu,
  X,
  LayoutDashboard,
  Table2,
  Lightbulb,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { DashboardData } from '../hooks/useDashboardData';
import { formatLocalDate, formatLocalTime, formatLocalDateTime } from '../utils/time';

interface TopBarProps {
  data?: DashboardData | null;
  loading?: boolean;
  /** When set (e.g. dashboard load failed), header shows Offline */
  connectionError?: string | null;
}

function hasGatewayData(data: DashboardData | null | undefined): boolean {
  if (!data) return false;
  return (
    data.summary != null ||
    data.health != null ||
    data.sales != null ||
    data.customers != null ||
    data.alerts != null
  );
}

function formatTimeAgo(iso?: string): string {
  if (!iso) return '—';
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
    return '—';
  }
}

function severityColor(s: string): string {
  const lower = (s ?? '').toLowerCase();
  if (lower === 'critical' || lower === 'error' || lower === 'high') return '#f87171';
  if (lower === 'warning' || lower === 'medium') return '#f59e0b';
  if (lower === 'success') return '#34d399';
  return '#3ecfff';
}

function severityIcon(s: string) {
  const lower = (s ?? '').toLowerCase();
  if (lower === 'critical' || lower === 'error' || lower === 'high') return XCircle;
  if (lower === 'warning' || lower === 'medium') return AlertTriangle;
  if (lower === 'success') return CheckCircle;
  return Info;
}

const mobileNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/monitoring', label: 'Monitoring', icon: Activity },
  { to: '/data-explorer', label: 'Data Explorer', icon: Table2 },
  { to: '/optimizations', label: 'Optimizations', icon: Lightbulb },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

export default function TopBar({ data = null, loading = false, connectionError = null }: TopBarProps) {
  const [time, setTime] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [readAlertKeys, setReadAlertKeys] = useState<string[]>([]);

  const READ_ALERTS_STORAGE_KEY = 'dashboard_read_alert_keys_v1';
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(READ_ALERTS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setReadAlertKeys(parsed.filter((v) => typeof v === 'string'));
      }
    } catch {
      // Ignore parse/storage errors.
    }
  }, []);

  const rawAlerts = Array.isArray(data?.alerts?.alerts) ? data.alerts.alerts : [];
  const alerts = rawAlerts.map((a, idx) => {
    const severity = a?.severity ?? a?.type ?? 'info';
    const key = `${a?.title ?? ''}|${a?.message ?? ''}|${a?.timestamp ?? ''}|${severity}|${idx}`;
    return {
      key,
      severity,
      color: severityColor(severity),
      icon: severityIcon(severity),
      message: (a?.message ?? a?.title ?? 'Alert').toString(),
      time: formatTimeAgo(a?.timestamp),
    };
  });
  const unreadCount = useMemo(
    () => alerts.filter((a) => !readAlertKeys.includes(a.key)).length,
    [alerts, readAlertKeys]
  );

  const gatewayReachable = hasGatewayData(data);
  const live = !loading && gatewayReachable && !connectionError;

  const markAllAsRead = () => {
    const next = Array.from(new Set([...readAlertKeys, ...alerts.map((a) => a.key)]));
    setReadAlertKeys(next);
    try {
      localStorage.setItem(READ_ALERTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors.
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0c0f1a]/80 backdrop-blur-xl border-b border-[#1e2540]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 min-h-14 flex flex-wrap items-center justify-between gap-2 py-2 md:py-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 md:flex-none">
          <button
            type="button"
            className="md:hidden shrink-0 w-9 h-9 rounded-lg bg-[#0c0f1a] border border-[#1e2540] flex items-center justify-center text-[#a0b0cc] hover:text-white hover:border-[#2a3a60] transition-colors"
            aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="w-8 h-8 rounded-full border-2 border-[#3ecfff] flex items-center justify-center shrink-0">
            <Compass size={16} className="text-[#3ecfff]" />
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-body text-sm sm:text-base font-bold tracking-tight truncate" style={{ color: '#ffffff' }}>DataWarehouse</span>
            <span className="font-mono text-[10px] text-[#4a5a7a] tracking-widest uppercase hidden sm:inline">Monitor</span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="w-8 h-8 rounded-lg bg-[#0c0f1a] border border-[#1e2540] flex items-center justify-center text-[#a0b0cc] hover:text-white hover:border-[#2a3a60] transition-colors"
              aria-label="Open notifications"
            >
              <Bell size={14} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#f87171] text-[9px] font-mono text-white flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-[min(360px,calc(100vw-2rem))] max-h-[min(420px,70vh)] overflow-y-auto rounded-xl bg-[#111628] border border-[#1e2540] shadow-2xl p-3 z-50">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="font-body text-sm font-semibold text-white">Notifications</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="font-mono text-[10px] text-[#3ecfff] hover:text-[#6edfff] underline underline-offset-2"
                    >
                      Mark all as read
                    </button>
                    <span className="font-mono text-[10px] text-[#4a5a7a]">{alerts.length} alerts</span>
                  </div>
                </div>
                {loading && alerts.length === 0 && (
                  <div className="py-8 text-center font-mono text-[11px] text-[#5a6a8a]">Loading alerts…</div>
                )}
                {!loading && alerts.length === 0 && (
                  <div className="py-8 text-center font-mono text-[11px] text-[#5a6a8a]">No alerts</div>
                )}
                {alerts.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <div key={a.key} className="p-2.5 rounded-lg border border-[#1e2540] bg-[#0c0f1a] mb-2 last:mb-0">
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${a.color}1A` }}>
                          <Icon size={12} style={{ color: a.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-xs text-[#c0cde0] leading-snug">{a.message}</p>
                          <span className="font-mono text-[10px] text-[#4a5a7a]">
                            {a?.time === '—' ? formatLocalDateTime(a?.timestamp) : a.time}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <Link to="/monitoring" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3ecfff10] border border-[#3ecfff25] hover:bg-[#3ecfff18] transition-colors">
            <Activity size={12} className="text-[#3ecfff]" />
            <span className="font-mono text-[10px] text-[#3ecfff] font-bold tracking-wider">Monitoring</span>
          </Link>
          <div className="flex items-center gap-1.5 min-w-0">
            {loading ? (
              <>
                <Radio size={12} className="text-[#64748b] shrink-0" />
                <span className="font-mono text-[10px] text-[#64748b] font-bold tracking-wider uppercase truncate">
                  Connecting
                </span>
              </>
            ) : live ? (
              <>
                <Radio size={12} className="text-[#34d399] animate-pulse shrink-0" />
                <span className="font-mono text-[10px] text-[#34d399] font-bold tracking-wider uppercase">Live</span>
              </>
            ) : (
              <>
                <Radio size={12} className="text-[#f59e0b] shrink-0" />
                <span className="font-mono text-[10px] text-[#f59e0b] font-bold tracking-wider uppercase">Offline</span>
              </>
            )}
          </div>
          <div className="font-mono text-[10px] sm:text-xs text-[#5a6a8a] tabular-nums">
            <span className="hidden sm:inline">
              {formatLocalDate(time)}
              <span className="text-[#2a3555] mx-1.5">/</span>
            </span>
            {formatLocalTime(time)}
          </div>
        </div>
      </div>

      {mobileNavOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-[2px] md:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <nav
            className="fixed left-0 right-0 top-14 z-[100] md:hidden border-b border-[#1e2540] bg-[#0c0f1a]/98 backdrop-blur-xl shadow-xl max-h-[min(72vh,calc(100dvh-4rem))] overflow-y-auto"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-0.5">
              {mobileNav.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-[#c0cde0] hover:bg-[#3ecfff10] hover:text-[#3ecfff] transition-colors font-body text-sm font-medium"
                >
                  <Icon size={18} className="text-[#5a6a8a] shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
