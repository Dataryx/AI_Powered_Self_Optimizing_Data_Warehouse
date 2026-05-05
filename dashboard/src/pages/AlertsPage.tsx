import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Radio,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  BellRing,
  Clock,
  Sparkles,
  LayoutList,
  Flame,
  Zap,
  Info,
  CircleDot,
  Inbox,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import SidebarPageShell from '../components/SidebarPageShell';
import MobileMenuButton from '../components/MobileMenuButton';
import { useAlertsData } from '../hooks/useAlertsData';
import { formatLocalTime } from '../utils/time';
import { api } from '../services/api';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info', 'warning'] as const;

const INBOX_PAGE_SIZE = 5;
const ANOM_PAGE_SIZE = 5;
const INC_PAGE_SIZE = 5;

type AlertsTab = 'inbox' | 'anomalies' | 'incidents';

function alertsTabFromHash(hash: string): AlertsTab {
  const h = hash.replace(/^#/, '').toLowerCase();
  if (h === 'anomalies' || h === 'incidents' || h === 'inbox') return h;
  return 'inbox';
}

function severityPillClass(sev: string): string {
  if (sev === 'critical') return 'bg-red-500/[0.08] text-red-200/90 border-red-500/20';
  return 'bg-[#12182a] text-[#8a9aaa] border-[#2a3555]';
}

function severityBarClass(sev: string): string {
  if (sev === 'critical') return 'bg-red-500/60';
  return 'bg-[#3a4a62]';
}

function severityIconWrapClass(sev: string): string {
  if (sev === 'critical') return 'bg-red-500/[0.1] text-red-200/90 border-red-500/22';
  return 'bg-[#12182a] text-[#8a9aaa] border-[#2a3555]';
}

function SeverityGlyph({ severity }: { severity: string }) {
  const cn = 'shrink-0';
  const sz = 16;
  switch (severity) {
    case 'critical':
      return <Flame size={sz} className={cn} strokeWidth={1.75} />;
    case 'high':
      return <Zap size={sz} className={cn} strokeWidth={1.75} />;
    case 'medium':
    case 'warning':
      return <AlertTriangle size={sz} className={cn} strokeWidth={1.75} />;
    case 'low':
      return <CircleDot size={sz} className={cn} strokeWidth={1.75} />;
    case 'info':
      return <Info size={sz} className={cn} strokeWidth={1.75} />;
    default:
      return <BellRing size={sz} className={cn} strokeWidth={1.75} />;
  }
}

function formatAnomalyLine(a: Record<string, unknown>): string {
  if (typeof a.message === 'string' && a.message) return a.message;
  if (typeof a.description === 'string' && a.description) return a.description;
  if (a.type === 'insert_rate_drop' && typeof a.table === 'string') {
    return `Insert rate low on ${a.table}: ${String(a.actual_value ?? '—')} vs baseline ~${String(a.expected_value ?? '—')}`;
  }
  if (a.type === 'unusual_row_size' && typeof a.table === 'string') {
    return `Unusual row size on ${a.table}: ${String(a.actual_value ?? '—')} vs avg ${String(a.expected_value ?? '—')}`;
  }
  if (typeof a.title === 'string' && a.title) return a.title;
  return 'Anomaly detected';
}

function formatDetailScalar(key: string, v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    if (key === 'timestamp' || key.endsWith('_at')) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return formatLocalTime(d);
    }
    return v;
  }
  if (Array.isArray(v)) {
    const parts = v.map((x) => (x !== null && typeof x === 'object' ? JSON.stringify(x) : String(x)));
    if (parts.every((p) => p === '')) return null;
    return parts.join(', ');
  }
  return null;
}

const INBOX_DETAIL_KEYS: [string, string][] = [
  ['alert_id', 'Alert ID'],
  ['title', 'Title'],
  ['type', 'Type'],
  ['severity', 'Severity'],
  ['status', 'Status'],
  ['layer', 'Layer'],
  ['table', 'Table'],
  ['timestamp', 'Detected'],
  ['acknowledged', 'Acknowledged'],
];

function inboxDetailRows(a: Record<string, unknown>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const used = new Set<string>(['message']);
  for (const [key, label] of INBOX_DETAIL_KEYS) {
    const s = formatDetailScalar(key, a[key]);
    if (s !== null) {
      rows.push({ label, value: s });
      used.add(key);
    }
  }
  for (const key of Object.keys(a)) {
    if (used.has(key)) continue;
    const s = formatDetailScalar(key, a[key]);
    if (s !== null) rows.push({ label: key.replace(/_/g, ' '), value: s });
  }
  return rows;
}

const ANOM_DETAIL_KEYS: [string, string][] = [
  ['id', 'ID'],
  ['type', 'Type'],
  ['severity', 'Severity'],
  ['table', 'Table'],
  ['timestamp', 'Detected'],
  ['actual_value', 'Actual'],
  ['expected_value', 'Expected / baseline'],
];

function anomalyDetailRows(an: Record<string, unknown>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const used = new Set<string>(['message', 'description', 'title']);
  for (const [key, label] of ANOM_DETAIL_KEYS) {
    const s = formatDetailScalar(key, an[key]);
    if (s !== null) {
      rows.push({ label, value: s });
      used.add(key);
    }
  }
  for (const key of Object.keys(an)) {
    if (used.has(key)) continue;
    const s = formatDetailScalar(key, an[key]);
    if (s !== null) rows.push({ label: key.replace(/_/g, ' '), value: s });
  }
  return rows;
}

const INC_DETAIL_KEYS: [string, string][] = [
  ['incident_id', 'Incident ID'],
  ['status', 'Status'],
  ['severity', 'Severity'],
  ['alert_count', 'Related alerts'],
  ['started_at', 'Started'],
  ['resolved_at', 'Resolved'],
];

function incidentDetailRows(inc: Record<string, unknown>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const used = new Set<string>(['title', 'description', 'affected_tables']);
  for (const [key, label] of INC_DETAIL_KEYS) {
    const s = formatDetailScalar(key, inc[key]);
    if (s !== null) {
      rows.push({ label, value: s });
      used.add(key);
    }
  }
  const aff = inc.affected_tables;
  if (Array.isArray(aff) && aff.length > 0) {
    rows.push({ label: 'Affected tables', value: aff.map(String).join(', ') });
  }
  for (const key of Object.keys(inc)) {
    if (used.has(key)) continue;
    const s = formatDetailScalar(key, inc[key]);
    if (s !== null) rows.push({ label: key.replace(/_/g, ' '), value: s });
  }
  return rows;
}

function DetailBlock({
  title,
  rows,
  body,
  bodyLabel,
}: {
  title?: string;
  rows: { label: string; value: string }[];
  body?: string;
  bodyLabel?: string;
}) {
  return (
    <div className="space-y-3">
      {title ? <p className="font-body text-xs font-semibold text-[#e0e8f5]">{title}</p> : null}
      {rows.length > 0 ? (
        <dl className="space-y-2">
          {rows.map((r, i) => (
            <div key={`${i}-${r.label}`}>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-[#5a6a8a]">{r.label}</dt>
              <dd className="text-xs text-[#c0cde0] break-words mt-0.5">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {body ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#5a6a8a] mb-1">{bodyLabel ?? 'Details'}</p>
          <p className="text-xs text-[#c0cde0] leading-relaxed whitespace-pre-wrap font-body">{body}</p>
        </div>
      ) : null}
    </div>
  );
}

function slicePage<T>(items: T[], page: number, pageSize: number): { slice: T[]; totalPages: number; safePage: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { slice: items.slice(start, start + pageSize), totalPages, safePage };
}

function buildPageList(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  return Array.from(pages).sort((a, b) => a - b);
}

function PaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  loading,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  loading: boolean;
}) {
  if (loading || totalItems === 0) return null;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);
  const pages = buildPageList(safePage, totalPages);

  return (
    <nav
      className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 mt-3 border-t border-[#1e2540]"
      aria-label="Pagination"
    >
      <p className="font-body text-[11px] text-[#5a6a8a] tabular-nums text-center sm:text-left">
        Showing <span className="text-[#c0cde0] font-medium">{start}</span>–<span className="text-[#c0cde0] font-medium">{end}</span>{' '}
        of <span className="text-[#c0cde0] font-medium">{totalItems}</span>
      </p>
      <div className="flex items-center justify-center gap-1 flex-wrap">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
          className="p-1.5 rounded-md border border-[#2a3555] bg-[#0c0f1a] text-[#5a6a8a] hover:text-[#c0cde0] hover:border-[#3a4a62] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="First page"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="p-1.5 rounded-md border border-[#2a3555] bg-[#0c0f1a] text-[#5a6a8a] hover:text-[#c0cde0] hover:border-[#3a4a62] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex items-center gap-0.5 px-1">
          {pages.map((p, idx) => {
            const prev = pages[idx - 1];
            const showGap = idx > 0 && prev !== undefined && p - prev > 1;
            return (
              <span key={p} className="inline-flex items-center">
                {showGap ? (
                  <span className="w-7 text-center font-body text-[10px] text-[#5a6a8a] select-none" aria-hidden>
                    …
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={[
                    'min-w-[2rem] h-8 rounded-md font-body text-[11px] font-semibold tabular-nums transition-all',
                    p === safePage
                      ? 'bg-[#1a2235] text-[#e0e8f5] border border-[#3ecfff35]'
                      : 'text-[#5a6a8a] hover:text-[#c0cde0] border border-transparent hover:bg-[#12182a]',
                  ].join(' ')}
                  aria-current={p === safePage ? 'page' : undefined}
                >
                  {p}
                </button>
              </span>
            );
          })}
        </div>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="p-1.5 rounded-md border border-[#2a3555] bg-[#0c0f1a] text-[#5a6a8a] hover:text-[#c0cde0] hover:border-[#3a4a62] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="p-1.5 rounded-md border border-[#2a3555] bg-[#0c0f1a] text-[#5a6a8a] hover:text-[#c0cde0] hover:border-[#3a4a62] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          aria-label="Last page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </nav>
  );
}

function FeedSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 p-3 rounded-lg border border-[#1e2540] bg-[#0c0f1a] animate-pulse"
        >
          <div className="h-8 w-8 rounded-md bg-[#1a2235] shrink-0" />
          <div className="flex-1 space-y-1.5 pt-0.5">
            <div className="h-2.5 w-24 rounded bg-[#1a2235]" />
            <div className="h-3 w-[88%] max-w-md rounded bg-[#1a2235]" />
            <div className="h-2.5 w-32 rounded bg-[#1a2235]" />
          </div>
        </div>
      ))}
    </div>
  );
}

const tabs: { id: AlertsTab; label: string; desc: string; icon: typeof Inbox }[] = [
  { id: 'inbox', label: 'Inbox', desc: 'Actionable alerts', icon: Inbox },
  { id: 'anomalies', label: 'Anomalies', desc: 'ML & baselines', icon: TrendingUp },
  { id: 'incidents', label: 'Incidents', desc: 'Grouped signals', icon: ShieldCheck },
];

export default function AlertsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, loading, error, refetch } = useAlertsData();
  const meta = data?.meta;
  const activeAlerts = Array.isArray(data?.alerts) ? data.alerts : [];
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [ackBusy, setAckBusy] = useState<string | null>(null);
  const [ackAllBusy, setAckAllBusy] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const prevLoading = useRef(loading);
  const [tab, setTab] = useState<AlertsTab>(() =>
    typeof window !== 'undefined' ? alertsTabFromHash(window.location.hash) : 'inbox',
  );

  useEffect(() => {
    setTab(alertsTabFromHash(location.hash));
  }, [location.hash]);

  const selectTab = useCallback(
    (id: AlertsTab) => {
      setTab(id);
      navigate({ pathname: '/alerts', hash: `#${id}` }, { replace: true });
    },
    [navigate],
  );
  const [inboxPage, setInboxPage] = useState(1);
  const [anomPage, setAnomPage] = useState(1);
  const [incPage, setIncPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    if (prevLoading.current && !loading) {
      setLastFetchedAt(new Date());
    }
    prevLoading.current = loading;
  }, [loading]);

  const anomalies = Array.isArray(data?.anomalies) ? data.anomalies : [];
  const incidents = Array.isArray(data?.incidents) ? data.incidents : [];
  const bySeverity = meta?.active?.by_severity ?? {};

  const visibleAlerts = useMemo(
    () =>
      activeAlerts.filter((a: { alert_id?: string }) => {
        const id = String(a?.alert_id ?? '');
        if (!id) return true;
        return !dismissedIds.has(id);
      }),
    [activeAlerts, dismissedIds],
  );

  const ackableAlertIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of visibleAlerts as Array<{ alert_id?: string }>) {
      const id = String(a?.alert_id ?? '').trim();
      if (id) ids.add(id);
    }
    return Array.from(ids);
  }, [visibleAlerts]);

  const inboxSlice = useMemo(
    () => slicePage(visibleAlerts, inboxPage, INBOX_PAGE_SIZE),
    [visibleAlerts, inboxPage],
  );
  const anomSlice = useMemo(() => slicePage(anomalies, anomPage, ANOM_PAGE_SIZE), [anomalies, anomPage]);
  const incSlice = useMemo(() => slicePage(incidents, incPage, INC_PAGE_SIZE), [incidents, incPage]);

  useEffect(() => {
    if (inboxPage > inboxSlice.totalPages) setInboxPage(inboxSlice.totalPages);
  }, [inboxPage, inboxSlice.totalPages]);

  useEffect(() => {
    if (anomPage > anomSlice.totalPages) setAnomPage(anomSlice.totalPages);
  }, [anomPage, anomSlice.totalPages]);

  useEffect(() => {
    if (incPage > incSlice.totalPages) setIncPage(incSlice.totalPages);
  }, [incPage, incSlice.totalPages]);

  useEffect(() => {
    setExpandedKey(null);
  }, [tab]);

  const onAcknowledge = useCallback(
    async (alertId: string) => {
      setAckError(null);
      setAckBusy(alertId);
      try {
        await api.acknowledgeAlert(alertId);
        setDismissedIds((prev) => new Set(prev).add(alertId));
        await refetch();
      } catch (e) {
        setAckError(e instanceof Error ? e.message : 'Acknowledge failed');
      } finally {
        setAckBusy(null);
      }
    },
    [refetch],
  );

  const onAcknowledgeAll = useCallback(async () => {
    if (ackableAlertIds.length === 0) return;
    setAckError(null);
    setAckAllBusy(true);
    try {
      await api.acknowledgeAlertsBatch(ackableAlertIds);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        ackableAlertIds.forEach((id) => next.add(id));
        return next;
      });
      setInboxPage(1);
      setExpandedKey(null);
      await refetch();
    } catch (e) {
      setAckError(e instanceof Error ? e.message : 'Acknowledge all failed');
    } finally {
      setAckAllBusy(false);
    }
  }, [ackableAlertIds, refetch]);

  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const anomaliesTotal = meta?.anomalies?.total ?? anomalies.length;
  const incidentsOpen = meta?.incidents?.open ?? incidents.filter((i) => i?.status === 'open').length;
  const incidentsResolved =
    meta?.incidents?.resolved ?? incidents.filter((i) => i?.status === 'resolved').length;

  return (
    <SidebarPageShell className="bg-[#0a0d18] min-h-screen text-[#c0cde0]">
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 800px 600px at 30% 20%, rgba(62,207,255,0.03) 0%, transparent 70%), radial-gradient(ellipse 600px 500px at 80% 70%, rgba(167,139,250,0.02) 0%, transparent 70%)',
        }}
      />

      <header className="relative z-40 min-h-14 bg-[#0c0f1a] border-b border-[#1e2540] sticky top-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2 sm:py-0 sm:min-h-14 sm:items-center">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <MobileMenuButton variant="dark" />
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-1 text-[#5a6a8a] hover:text-[#c0cde0] transition-colors shrink-0"
            >
              <ChevronLeft size={16} aria-hidden />
              <span className="font-mono text-[11px] tracking-wider">Home</span>
            </button>
            <span className="text-[#2a3555] hidden sm:inline" aria-hidden>
              /
            </span>
            <span className="sm:hidden font-body text-sm font-semibold text-[#c0cde0] truncate min-w-0">Alerts</span>
            <div className="items-center gap-2 min-w-0 hidden sm:flex">
              <BellRing size={14} className="text-[#3ecfff] shrink-0" aria-hidden />
              <span className="font-body text-sm font-semibold text-[#c0cde0] truncate">Alerts</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0d3a2a] border border-[#1a5c40]">
              <Radio size={10} className="text-[#34d399] animate-pulse" aria-hidden />
              <span className="font-mono text-[9px] text-[#34d399] font-bold tracking-widest uppercase">Live</span>
            </div>
            {tab === 'inbox' && ackableAlertIds.length > 0 ? (
              <button
                type="button"
                onClick={() => void onAcknowledgeAll()}
                disabled={loading || ackAllBusy || ackBusy != null}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-[#12182a] border border-[#2e6b4a] text-[#a7f3d0] hover:border-[#34d39955] hover:bg-[#0d2818] transition-colors disabled:opacity-40"
              >
                {ackAllBusy ? <RefreshCw size={14} className="animate-spin" aria-hidden /> : <CheckCircle size={14} aria-hidden />}
                Acknowledge all ({ackableAlertIds.length})
              </button>
            ) : null}
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-[#12182a] border border-[#2a3555] text-[#c0cde0] hover:border-[#3a4a62] hover:bg-[#1a2235] transition-colors disabled:opacity-40"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-12 w-full">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#3ecfff12] border border-[#3ecfff25] flex items-center justify-center shrink-0">
              <BellRing size={16} className="text-[#3ecfff]" aria-hidden />
            </div>
            <h1 className="font-body text-2xl sm:text-3xl font-bold text-[#e0e8f5] tracking-tight">Alerts &amp; incidents</h1>
          </div>
          {/* <p className="font-body text-sm text-[#5a6a8a] ml-0 sm:ml-10 mt-1 sm:mt-0 max-w-2xl">
            Live checks from Postgres, ETL, and query logs. Lists are paginated. Acknowledge stores a dismissal in the database so it stays hidden across restarts.
          </p> */}
          <p className="font-mono text-[10px] text-[#5a6a8a] mt-2 ml-0 sm:ml-10 tabular-nums">
            Last loaded{' '}
            {lastFetchedAt ? (
              <time dateTime={lastFetchedAt.toISOString()} className="text-[#8a9aaa]">
                {formatLocalTime(lastFetchedAt)}
              </time>
            ) : (
              '—'
            )}
            {loading ? ' · updating…' : ''}
          </p>
        </motion.div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex gap-2 items-start">
            <AlertTriangle className="shrink-0 mt-0.5" size={16} />
            <div>
              <p className="font-medium">{error}</p>
              <button type="button" onClick={refresh} className="mt-1.5 text-xs underline underline-offset-2">
                Try again
              </button>
            </div>
          </div>
        )}

        {ackError && (
          <div className="mb-4 p-3 rounded-lg bg-[#2a2018] border border-[#4a3828] text-[#c4b4a0] text-xs flex gap-2 items-center">
            <Sparkles size={14} className="shrink-0 opacity-70" />
            {ackError}
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-5">
          {[
            { label: 'Open in inbox', value: loading ? '—' : visibleAlerts.length },
            { label: 'Anomalies', value: loading ? '—' : anomaliesTotal },
            { label: 'Open incidents', value: loading ? '—' : incidentsOpen },
            { label: 'Resolved', value: loading ? '—' : incidentsResolved },
          ].map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              className="rounded-lg border border-[#1e2540] bg-[#0c0f1a] px-3 py-2.5"
            >
              <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-[#5a6a8a]">{k.label}</p>
              <p className="mt-1 text-lg sm:text-xl font-bold tabular-nums text-[#e0e8f5]">{k.value}</p>
            </motion.div>
          ))}
        </div>

        {!loading && (meta?.active?.total ?? 0) > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2 justify-start p-3 rounded-lg border border-[#1e2540] bg-[#0c0f1a]">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#5a6a8a] w-full sm:w-auto">Severity mix</span>
            <div className="flex flex-wrap gap-2">
              {SEVERITY_ORDER.map((s) => {
                const n = bySeverity[s] ?? 0;
                if (!n) return null;
                return (
                  <span
                    key={s}
                    className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-md border capitalize ${severityPillClass(s)}`}
                  >
                    <span className={`h-1 w-1 rounded-full ${severityBarClass(s)}`} />
                    {s} · {n}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Main panel: tabs + paginated content */}
        <div className="rounded-lg border border-[#1e2540] bg-[#0c0f1a] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-stretch border-b border-[#1e2540]">
            {tabs.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTab(t.id)}
                  className={[
                    'flex-1 flex items-center gap-2 px-3 py-2 text-left transition-colors relative',
                    active
                      ? 'text-[#e0e8f5] bg-[#12182a] after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-[#3ecfff]'
                      : 'text-[#5a6a8a] hover:text-[#c0cde0] hover:bg-[#0a0e14]',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-8 w-8 items-center justify-center rounded-md border shrink-0',
                      active ? 'border-[#3ecfff35] bg-[#3ecfff10] text-[#3ecfff]' : 'border-[#2a3555] bg-[#0a0e14]',
                    ].join(' ')}
                  >
                    <Icon size={16} strokeWidth={1.65} />
                  </span>
                  <span className="min-w-0">
                    <span className="font-body text-xs font-semibold block leading-tight">{t.label}</span>
                    <span className="font-mono text-[9px] text-[#5a6a8a] block mt-0.5 leading-tight">{t.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-3 sm:p-4 min-h-[18rem]">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="sk"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-2"
                >
                  <FeedSkeleton rows={5} />
                </motion.div>
              ) : tab === 'inbox' ? (
                <motion.div
                  key="inbox"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {visibleAlerts.length === 0 && activeAlerts.length > 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                      <CheckCircle size={36} className="text-[#5a6a8a] mb-3" strokeWidth={1.25} />
                      <h3 className="font-body text-sm font-semibold text-[#e0e8f5]">All caught up</h3>
                      <p className="text-xs text-[#5a6a8a] mt-1.5 max-w-sm">Acknowledged items are hidden. Refresh to sync.</p>
                      <button
                        type="button"
                        onClick={refresh}
                        className="mt-4 px-3 py-1.5 rounded-md text-xs font-medium bg-[#12182a] border border-[#2a3555] text-[#c0cde0] hover:border-[#3a4a62]"
                      >
                        Refresh
                      </button>
                    </div>
                  ) : visibleAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                      <LayoutList size={32} className="text-[#5a6a8a] mb-3" strokeWidth={1.25} />
                      <h3 className="font-body text-sm font-semibold text-[#e0e8f5]">No active alerts</h3>
                      <p className="text-xs text-[#5a6a8a] mt-1.5 max-w-sm">Automated checks show nothing to action.</p>
                    </div>
                  ) : (
                    <>
                      <ul className="space-y-2 list-none p-0 m-0">
                        {inboxSlice.slice.map((a: Record<string, unknown>, idx: number) => {
                          const id = String(a.alert_id ?? '');
                          const rowKey = id || `alert-row-${idx}`;
                          const detailKey = `inbox:${rowKey}`;
                          const expanded = expandedKey === detailKey;
                          const canAck = Boolean(id);
                          const sev = String(a.severity ?? 'medium');
                          const title = String(a.title ?? a.type ?? 'Alert');
                          const typeStr = typeof a.type === 'string' && a.type && a.type !== title ? a.type : '';
                          const msg = typeof a.message === 'string' && a.message ? a.message : '';
                          const detailRows = inboxDetailRows(a);
                          return (
                            <li
                              key={rowKey}
                              className="group relative rounded-lg border border-[#1e2540] bg-[#0a0e14] hover:border-[#2a3555] transition-colors overflow-hidden"
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${severityBarClass(sev)}`} aria-hidden />
                              <div className="flex flex-col lg:flex-row lg:items-stretch">
                                <button
                                  type="button"
                                  onClick={() => setExpandedKey(expanded ? null : detailKey)}
                                  className="flex-1 min-w-0 flex text-left gap-2 pl-3 pr-2 py-2.5 lg:pr-3 lg:items-center"
                                  aria-expanded={expanded}
                                >
                                  <ChevronDown
                                    size={14}
                                    className={`shrink-0 mt-0.5 lg:mt-0 text-[#5a6a8a] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                                    aria-hidden
                                  />
                                  <div
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${severityIconWrapClass(sev)}`}
                                  >
                                    <SeverityGlyph severity={sev} />
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span
                                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${severityPillClass(sev)}`}
                                      >
                                        {sev}
                                      </span>
                                      {typeStr ? (
                                        <span className="text-[10px] text-[#5a6a8a] truncate max-w-[14rem]">
                                          {typeStr.replace(/_/g, ' ')}
                                        </span>
                                      ) : null}
                                    </div>
                                    <h3 className="font-body text-sm font-semibold text-[#e0e8f5] leading-snug">{title}</h3>
                                    {msg ? (
                                      <p className="font-body text-xs text-[#8a9aaa] leading-relaxed line-clamp-2">{msg}</p>
                                    ) : null}
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                      {typeof a.timestamp === 'string' ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-[#5a6a8a] tabular-nums px-1.5 py-0.5 rounded border border-[#2a3555] bg-[#0c0f1a]">
                                          <Clock size={11} />
                                          {formatLocalTime(new Date(a.timestamp))}
                                        </span>
                                      ) : null}
                                      {typeof a.table === 'string' && a.table ? (
                                        <span className="text-[10px] text-[#8a9aaa] px-1.5 py-0.5 rounded border border-[#2a3555] bg-[#0c0f1a] truncate max-w-full font-mono">
                                          {a.table}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </button>
                                <div className="flex px-3 pb-2.5 pt-0 lg:py-2.5 lg:pr-3 lg:pl-0 lg:items-start lg:border-l lg:border-[#1e2540]">
                                  <button
                                    type="button"
                                    disabled={!canAck || ackBusy === id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canAck) void onAcknowledge(id);
                                    }}
                                    className="w-full lg:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#12182a] border border-[#2a3555] text-[#c0cde0] hover:border-[#3ecfff40] hover:bg-[#1a2235] disabled:opacity-35 transition-colors"
                                  >
                                    {ackBusy === id ? (
                                      <>
                                        <RefreshCw size={13} className="animate-spin" />
                                        Working…
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle size={14} />
                                        Acknowledge
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                              {expanded ? (
                                <div className="border-t border-[#1e2540] bg-[#060810] px-3 py-3 pl-[2.35rem] sm:pl-10">
                                  <DetailBlock
                                    rows={detailRows}
                                    body={msg || undefined}
                                    bodyLabel="Full message"
                                  />
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                      <PaginationBar
                        page={inboxPage}
                        totalPages={inboxSlice.totalPages}
                        totalItems={visibleAlerts.length}
                        pageSize={INBOX_PAGE_SIZE}
                        onPageChange={setInboxPage}
                        loading={loading}
                      />
                    </>
                  )}
                </motion.div>
              ) : tab === 'anomalies' ? (
                <motion.div
                  key="anom"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {anomalies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                      <Sparkles size={32} className="text-[#5a6a8a] mb-3" />
                      <h3 className="font-body text-sm font-semibold text-[#e0e8f5]">No anomalies</h3>
                      <p className="text-xs text-[#5a6a8a] mt-1.5 max-w-sm">Baselines look normal.</p>
                    </div>
                  ) : (
                    <>
                      <ul className="space-y-2 list-none p-0 m-0">
                        {anomSlice.slice.map((an: Record<string, unknown>, i: number) => {
                          const key = typeof an.id === 'string' ? an.id : `anom-${i}`;
                          const detailKey = `anom:${key}`;
                          const expanded = expandedKey === detailKey;
                          const sev = String(an.severity ?? 'medium');
                          const summary = formatAnomalyLine(an);
                          const rawMsg = typeof an.message === 'string' ? an.message : '';
                          const rawDesc = typeof an.description === 'string' ? an.description : '';
                          let bodyText = '';
                          if (rawMsg && rawDesc && rawMsg !== rawDesc) {
                            bodyText = `${rawMsg}\n\n${rawDesc}`;
                          } else if (rawMsg) {
                            bodyText = rawMsg;
                          } else if (rawDesc) {
                            bodyText = rawDesc;
                          } else if (summary) {
                            bodyText = summary;
                          }
                          return (
                            <li
                              key={key}
                              className="rounded-lg border border-[#1e2540] bg-[#0a0e14] hover:border-[#2a3555] transition-colors overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => setExpandedKey(expanded ? null : detailKey)}
                                className="w-full text-left p-3 flex gap-2"
                                aria-expanded={expanded}
                              >
                                <ChevronDown
                                  size={14}
                                  className={`shrink-0 mt-0.5 text-[#5a6a8a] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                                  aria-hidden
                                />
                                <div className="w-8 h-8 rounded-md bg-[#12182a] border border-[#2a3555] flex items-center justify-center shrink-0">
                                  <AlertTriangle size={15} className="text-[#8a9aaa]" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${severityPillClass(sev)}`}
                                    >
                                      {sev}
                                    </span>
                                    {typeof an.type === 'string' ? (
                                      <span className="text-[10px] text-[#5a6a8a]">{an.type}</span>
                                    ) : null}
                                  </div>
                                  <p className="font-body text-xs text-[#c0cde0] mt-1.5 leading-relaxed line-clamp-2">{summary}</p>
                                  {typeof an.timestamp === 'string' ? (
                                    <p className="text-[10px] text-[#5a6a8a] mt-1.5 tabular-nums font-mono">
                                      {formatLocalTime(new Date(an.timestamp))}
                                    </p>
                                  ) : null}
                                </div>
                              </button>
                              {expanded ? (
                                <div className="border-t border-[#1e2540] bg-[#060810] px-3 py-3 pl-10">
                                  <DetailBlock
                                    title={typeof an.title === 'string' && an.title ? an.title : undefined}
                                    rows={anomalyDetailRows(an)}
                                    body={bodyText || undefined}
                                    bodyLabel="Summary & notes"
                                  />
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                      <PaginationBar
                        page={anomPage}
                        totalPages={anomSlice.totalPages}
                        totalItems={anomalies.length}
                        pageSize={ANOM_PAGE_SIZE}
                        onPageChange={setAnomPage}
                        loading={loading}
                      />
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="inc"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {incidents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                      <ShieldCheck size={32} className="text-[#5a6a8a] mb-3" />
                      <h3 className="font-body text-sm font-semibold text-[#e0e8f5]">No incidents</h3>
                      <p className="text-xs text-[#5a6a8a] mt-1.5 max-w-sm">Nothing grouped right now.</p>
                    </div>
                  ) : (
                    <>
                      <ul className="space-y-2 list-none p-0 m-0">
                        {incSlice.slice.map((inc: Record<string, unknown>, i: number) => {
                          const key = typeof inc.incident_id === 'string' ? inc.incident_id : `inc-${i}`;
                          const detailKey = `inc:${key}`;
                          const expanded = expandedKey === detailKey;
                          const sev = String(inc.severity ?? 'medium');
                          const open = String(inc.status ?? '').toLowerCase() === 'open';
                          const desc = typeof inc.description === 'string' && inc.description ? inc.description : '';
                          return (
                            <li
                              key={key}
                              className="rounded-lg border border-[#1e2540] bg-[#0a0e14] hover:border-[#2a3555] transition-colors overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => setExpandedKey(expanded ? null : detailKey)}
                                className="w-full text-left p-3 flex items-start gap-2"
                                aria-expanded={expanded}
                              >
                                <ChevronDown
                                  size={14}
                                  className={`shrink-0 mt-1 text-[#5a6a8a] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                                  aria-hidden
                                />
                                <div className="mt-1 flex flex-col items-center shrink-0">
                                  <span
                                    className={`h-2 w-2 rounded-full ${open ? 'bg-[#8a9aaa]' : 'bg-[#34d399]/50'}`}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-body text-sm font-semibold text-[#e0e8f5] pr-2">{String(inc.title ?? 'Incident')}</p>
                                  {desc ? (
                                    <p className="font-body text-xs text-[#8a9aaa] mt-1 leading-relaxed line-clamp-2">{desc}</p>
                                  ) : null}
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[10px] text-[#5a6a8a] font-mono">
                                    <span className={open ? 'text-[#c0cde0]' : 'text-[#8a9aaa]'}>{String(inc.status ?? '')}</span>
                                    {typeof inc.alert_count === 'number' ? <span>{inc.alert_count} alerts</span> : null}
                                    {typeof inc.started_at === 'string' ? (
                                      <span className="tabular-nums">Started {formatLocalTime(new Date(inc.started_at))}</span>
                                    ) : null}
                                  </div>
                                </div>
                                <span
                                  className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${severityPillClass(sev)}`}
                                >
                                  {sev}
                                </span>
                              </button>
                              {expanded ? (
                                <div className="border-t border-[#1e2540] bg-[#060810] px-3 py-3 pl-10">
                                  <DetailBlock
                                    rows={incidentDetailRows(inc)}
                                    body={desc || undefined}
                                    bodyLabel="Description"
                                  />
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                      <PaginationBar
                        page={incPage}
                        totalPages={incSlice.totalPages}
                        totalItems={incidents.length}
                        pageSize={INC_PAGE_SIZE}
                        onPageChange={setIncPage}
                        loading={loading}
                      />
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </SidebarPageShell>
  );
}
