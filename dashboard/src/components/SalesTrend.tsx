import { motion } from 'framer-motion';
import { useState, useMemo, useEffect, useRef, useId } from 'react';
import { CalendarRange, FileDown, Loader2 } from 'lucide-react';
import type { DashboardData } from '../hooks/useDashboardData';
import { api } from '../services/api';
import { loadMonitoringPreferences } from '../settings/monitoringPreferences';
import { downloadSalesDailyAsExcel } from '../utils/salesTrendExcelExport';

type DailyRow = { date: string; count?: number; sales?: number; revenue?: number };

/** Matches home-dashboard default so we can reuse bundled `daily_sales` without an extra request. */
const DEFAULT_RANGE_DAYS = 60;

/** Rolling window in days, or daily breakdown for the current calendar month only. */
type SalesTrendRange = number | 'current-month';

function initialRangeFromRetention(): SalesTrendRange {
  try {
    const d = loadMonitoringPreferences().retentionDays;
    if (!Number.isFinite(d)) return DEFAULT_RANGE_DAYS;
    const r = Math.round(Number(d));
    if (r === 0) return 0;
    return Math.min(730, Math.max(1, r));
  } catch {
    return DEFAULT_RANGE_DAYS;
  }
}

const RANGE_PRESETS: { id: SalesTrendRange; label: string; short: string }[] = [
  { id: 'current-month', label: 'This month — one point per day', short: '1 mo' },
  { id: 60, label: 'Last ~2 months', short: '2 mo' },
  { id: 180, label: 'Last 6 months', short: '6 mo' },
  { id: 365, label: 'Last year', short: '1 yr' },
  { id: 730, label: 'Last 2 years', short: '2 yr' },
  { id: 0, label: 'All time', short: 'All' },
];

/** API `days` param: long enough to include the 1st of the current month (local). */
function daysLookbackForCurrentMonth(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const span = Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.min(5000, Math.max(35, span + 5));
}

type MonthlyPoint = {
  /** Display label e.g. "Jan 2025" or "Wed, Apr 16" for daily mode */
  date: string;
  sales: number;
  revenue: number;
  /** YYYY-MM (month mode) or YYYY-MM-DD (current-month daily mode) */
  monthKey: string;
};

function dailyRowDateRaw(row: DailyRow): unknown {
  const r = row as Record<string, unknown>;
  return row.date ?? r.sale_date ?? r.order_date ?? r.date_key;
}

function toFiniteNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/**
 * Parse a dashboard daily row date: YYYY-MM-DD, ISO datetime (date part only, local),
 * or YYYYMMDD number/string. Avoids UTC-only parsing bugs and dropped rows.
 */
function parseChartDay(raw: unknown): Date | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.floor(raw);
    const s = String(n);
    if (s.length !== 8) return null;
    const y = Number(s.slice(0, 4));
    const mo = Number(s.slice(4, 6));
    const d = Number(s.slice(6, 8));
    const dt = new Date(y, mo - 1, d);
    if (Number.isNaN(dt.getTime())) return null;
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }
  const str = String(raw).trim();
  if (!str) return null;
  const head = str.split(/[T ]/)[0] ?? '';
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head);
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(head);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

function monthKeyFromRaw(raw: unknown): string {
  const dt = parseChartDay(raw);
  if (!dt) return '';
  const y = dt.getFullYear();
  const mo = dt.getMonth() + 1;
  return `${y}-${String(mo).padStart(2, '0')}`;
}

function currentMonthKeyLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function addMonthsToMonthKey(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Ensure the x-axis extends through the current calendar month when data is recent,
 * so "Sales Trend" does not stop at the prior month while the window includes today.
 */
function padMonthlyThroughCurrentMonth(points: MonthlyPoint[], rawDaily: DailyRow[]): MonthlyPoint[] {
  if (points.length === 0) return points;
  const curKey = currentMonthKeyLocal();
  const last = points[points.length - 1];
  if (last.monthKey >= curKey) return points;

  let lastDataDay: Date | null = null;
  for (const row of rawDaily) {
    const dt = parseChartDay(dailyRowDateRaw(row));
    if (dt && (!lastDataDay || dt.getTime() > lastDataDay.getTime())) lastDataDay = dt;
  }
  if (lastDataDay) {
    const daysSince = (Date.now() - lastDataDay.getTime()) / 86_400_000;
    if (daysSince > 730) return points;
  }

  const out = [...points];
  let k = addMonthsToMonthKey(last.monthKey, 1);
  while (k.localeCompare(curKey) <= 0) {
    out.push({
      monthKey: k,
      date: formatMonthLabel(k),
      sales: 0,
      revenue: 0,
    });
    k = addMonthsToMonthKey(k, 1);
  }
  return out;
}

function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Short x-axis tick (e.g. "Jan" or "Jan 25" if spanning multiple years). */
function formatMonthTick(yyyyMm: string, allKeys: string[]): string {
  const years = new Set(allKeys.map((k) => k.slice(0, 4)));
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  const dt = new Date(y, m - 1, 1);
  if (years.size <= 1) {
    return dt.toLocaleDateString('en-US', { month: 'short' });
  }
  return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/** Aggregate daily rows into calendar months (chronological). */
function normalizeMonthlyChartDataFromDaily(raw: DailyRow[] | null | undefined): MonthlyPoint[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const sortedAsc = [...raw].sort((a, b) => {
    const da = parseChartDay(dailyRowDateRaw(a))?.getTime() ?? 0;
    const db = parseChartDay(dailyRowDateRaw(b))?.getTime() ?? 0;
    return da - db;
  });

  const byMonth = new Map<string, { sales: number; revenue: number }>();
  for (const d of sortedAsc) {
    const key = monthKeyFromRaw(dailyRowDateRaw(d));
    if (!key) continue;
    const prev = byMonth.get(key) ?? { sales: 0, revenue: 0 };
    const r = d as Record<string, unknown>;
    prev.sales += toFiniteNumber(d.count ?? d.sales ?? r.sales_count);
    prev.revenue += toFiniteNumber(d.revenue ?? r.net_amount);
    byMonth.set(key, prev);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      monthKey: key,
      date: formatMonthLabel(key),
      sales: v.sales,
      revenue: v.revenue,
    }));
}

/** One point per calendar day in the current month (local); missing days are zero. */
function buildCurrentMonthDailyPoints(raw: DailyRow[] | null | undefined): MonthlyPoint[] {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  const lastDay = new Date(y, mo + 1, 0).getDate();
  const byDay = new Map<string, { sales: number; revenue: number }>();
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const dt = parseChartDay(dailyRowDateRaw(row));
      if (!dt || dt.getFullYear() !== y || dt.getMonth() !== mo) continue;
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const prev = byDay.get(iso) ?? { sales: 0, revenue: 0 };
      const r = row as Record<string, unknown>;
      prev.sales += toFiniteNumber(row.count ?? row.sales ?? r.sales_count);
      prev.revenue += toFiniteNumber(row.revenue ?? r.net_amount);
      byDay.set(iso, prev);
    }
  }
  const out: MonthlyPoint[] = [];
  for (let d = 1; d <= lastDay; d += 1) {
    const iso = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const agg = byDay.get(iso) ?? { sales: 0, revenue: 0 };
    const labelDt = new Date(y, mo, d);
    const title = labelDt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    out.push({
      monthKey: iso,
      date: title,
      sales: agg.sales,
      revenue: agg.revenue,
    });
  }
  return out;
}

function formatOrdersAxisTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

/** Right-axis revenue ticks: $0, $10M, $20M, … (values are raw dollars). */
function formatRevenueAxisTick(v: number): string {
  if (v <= 0) return '$0';
  const m = v / 1_000_000;
  if (m >= 1) {
    const whole = Math.round(m);
    if (Math.abs(m - whole) < 1e-6) return `$${whole}M`;
    return `$${m >= 10 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
}

const REV_AXIS_MIN_TOP = 40_000_000; // $40M → ticks $0 … $40M at 25% steps
const REV_AXIS_STEP = 10_000_000; // $10M grid

/** Top of revenue scale: at least $40M, then next whole $10M that fits peak revenue. */
function revenueAxisMax(maxRevenue: number): number {
  return Math.max(REV_AXIS_MIN_TOP, Math.ceil(maxRevenue / REV_AXIS_STEP) * REV_AXIS_STEP);
}

/** Smaller-scale axis for current-month daily view (warehouse totals are often far below $40M). */
function revenueAxisMaxDailyMonth(maxRevenue: number): number {
  if (maxRevenue <= 0) return 10_000;
  if (maxRevenue >= REV_AXIS_MIN_TOP) {
    return Math.max(REV_AXIS_MIN_TOP, Math.ceil(maxRevenue / REV_AXIS_STEP) * REV_AXIS_STEP);
  }
  const pad = Math.max(maxRevenue * 0.08, 1);
  const top = maxRevenue + pad;
  const step =
    top >= 1_000_000 ? 100_000 : top >= 100_000 ? 10_000 : top >= 10_000 ? 1_000 : top >= 1_000 ? 100 : 50;
  return Math.ceil(top / step) * step;
}

function plotHeight(h: number, padY: number): number {
  return h - padY * 2;
}

function buildPath(
  values: number[],
  max: number,
  w: number,
  h: number,
  padL: number,
  padR: number,
  padY: number,
): string {
  if (values.length === 0 || max <= 0) return '';
  const plotW = w - padL - padR;
  const ph = plotHeight(h, padY);
  if (values.length === 1) {
    const x = padL + plotW / 2;
    const y = h - padY - (values[0] / max) * ph;
    return `M${x},${y}`;
  }
  const step = plotW / (values.length - 1);
  return values
    .map((v, i) => {
      const x = padL + i * step;
      const y = h - padY - (v / max) * ph;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
}

function buildArea(
  values: number[],
  max: number,
  w: number,
  h: number,
  padL: number,
  padR: number,
  padY: number,
): string {
  if (values.length === 0 || max <= 0) return '';
  const plotW = w - padL - padR;
  const ph = plotHeight(h, padY);
  if (values.length === 1) {
    const x = padL + plotW / 2;
    const y = h - padY - (values[0] / max) * ph;
    const half = 8;
    return `M${x - half},${h - padY} L${x - half},${y} L${x + half},${y} L${x + half},${h - padY} Z`;
  }
  const step = plotW / (values.length - 1);
  const line = values
    .map((v, i) => {
      const x = padL + i * step;
      const y = h - padY - (v / max) * ph;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
  const lastX = padL + (values.length - 1) * step;
  return `${line} L${lastX},${h - padY} L${padL},${h - padY} Z`;
}

interface SalesTrendProps {
  data?: DashboardData | null;
  loading?: boolean;
}

export default function SalesTrend({ data = null, loading = false }: SalesTrendProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [salesRange, setSalesRange] = useState<SalesTrendRange>(() => initialRangeFromRetention());
  const [extraDaily, setExtraDaily] = useState<DailyRow[] | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const fetchSeqRef = useRef(0);
  const fillGradId = useId().replace(/:/g, '');

  const parentDaily = data?.sales?.daily_sales;
  const isCurrentMonthDaily = salesRange === 'current-month';
  /** Long windows: Excel download instead of chart (2 years or all time). */
  const isExcelExportRange = salesRange === 730 || salesRange === 0;
  const excelExportTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isExcelExportRange) {
      excelExportTriggeredRef.current = null;
    }
  }, [isExcelExportRange]);

  useEffect(() => {
    if (salesRange !== DEFAULT_RANGE_DAYS) return;
    if (Array.isArray(parentDaily) && parentDaily.length > 0) {
      fetchSeqRef.current += 1;
      setExtraDaily(null);
      setFetchLoading(false);
      setFetchError(null);
    }
  }, [salesRange, parentDaily]);

  useEffect(() => {
    const seq = ++fetchSeqRef.current;

    const useParentOnly =
      salesRange === DEFAULT_RANGE_DAYS && Array.isArray(parentDaily) && parentDaily.length > 0;

    if (useParentOnly) {
      setExtraDaily(null);
      setFetchError(null);
      setFetchLoading(false);
      return;
    }

    setExtraDaily([]);
    setFetchLoading(true);
    setFetchError(null);

    const fetchDays =
      salesRange === 'current-month'
        ? daysLookbackForCurrentMonth()
        : typeof salesRange === 'number'
          ? salesRange
          : DEFAULT_RANGE_DAYS;

    let cancelled = false;
    api
      .getSalesStats({ days: fetchDays })
      .then((res) => {
        if (cancelled || fetchSeqRef.current !== seq) return;
        setExtraDaily(Array.isArray(res.daily_sales) ? res.daily_sales : []);
      })
      .catch((e) => {
        if (cancelled || fetchSeqRef.current !== seq) return;
        setFetchError(e instanceof Error ? e.message : 'Could not load sales history');
        setExtraDaily([]);
      })
      .finally(() => {
        if (cancelled || fetchSeqRef.current !== seq) return;
        setFetchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [salesRange]);

  const chartDaily = useMemo((): DailyRow[] => {
    if (salesRange === DEFAULT_RANGE_DAYS && extraDaily === null) {
      return parentDaily ?? [];
    }
    return extraDaily ?? [];
  }, [salesRange, extraDaily, parentDaily]);

  useEffect(() => {
    if (!isExcelExportRange || fetchLoading || fetchError) return;
    if (chartDaily.length === 0) return;
    const first = dailyRowDateRaw(chartDaily[0]);
    const last = dailyRowDateRaw(chartDaily[chartDaily.length - 1]);
    const key = `${salesRange}|${chartDaily.length}|${String(first)}|${String(last)}`;
    if (excelExportTriggeredRef.current === key) return;
    excelExportTriggeredRef.current = key;
    downloadSalesDailyAsExcel(
      chartDaily,
      salesRange === 730 ? '2-years' : 'all-time',
    );
  }, [isExcelExportRange, fetchLoading, fetchError, chartDaily, salesRange]);

  const chartData = useMemo(() => {
    if (isExcelExportRange) {
      return [] as MonthlyPoint[];
    }
    if (isCurrentMonthDaily) {
      return buildCurrentMonthDailyPoints(chartDaily);
    }
    const monthly = normalizeMonthlyChartDataFromDaily(chartDaily);
    return padMonthlyThroughCurrentMonth(monthly, chartDaily);
  }, [chartDaily, isCurrentMonthDaily, isExcelExportRange]);
  const hasChartData = !isExcelExportRange && chartData.length >= 1;

  const showExportSkeleton = isExcelExportRange && fetchLoading;
  const showChartSkeleton =
    !isExcelExportRange &&
    !hasChartData &&
    (fetchLoading || (loading && salesRange === DEFAULT_RANGE_DAYS && !parentDaily?.length));
  const maxSales = hasChartData ? Math.max(...chartData.map((d) => d.sales), 1) : 1;
  const maxRevenue = hasChartData ? Math.max(...chartData.map((d) => d.revenue), 1) : 1;
  const revAxisMax = hasChartData
    ? isCurrentMonthDaily
      ? revenueAxisMaxDailyMonth(maxRevenue)
      : revenueAxisMax(maxRevenue)
    : isCurrentMonthDaily
      ? 10_000
      : REV_AXIS_MIN_TOP;

  const H = 280;
  const PY = 40;
  const PL = 52;
  const PR = 58;
  const W = 700;
  const salesPath = hasChartData
    ? buildPath(chartData.map((d) => d.sales), maxSales, W, H, PL, PR, PY)
    : '';
  const revPath = hasChartData
    ? buildPath(chartData.map((d) => d.revenue), revAxisMax, W, H, PL, PR, PY)
    : '';
  const salesArea = hasChartData
    ? buildArea(chartData.map((d) => d.sales), maxSales, W, H, PL, PR, PY)
    : '';
  const n = chartData.length;
  const plotW = W - PL - PR;
  const step = n > 1 ? plotW / (n - 1) : 0;

  const peakSales = hasChartData
    ? chartData.reduce((best, d) => (d.sales > best.sales ? d : best), chartData[0])
    : { sales: 0, date: '' };
  const peakRevenue = hasChartData
    ? chartData.reduce((best, d) => (d.revenue > best.revenue ? d : best), chartData[0])
    : { revenue: 0, date: '' };
  const avgPerDayOrMonth = hasChartData
    ? Math.round(chartData.reduce((a, b) => a + b.sales, 0) / chartData.length)
    : 0;

  const monthKeys = chartData.map((d) => d.monthKey);
  const chartAnimKey = `${String(salesRange)}-${chartDaily.length}-${chartData.map((d) => d.monthKey).join(',')}`;

  return (
    <div className="bg-[#111628] rounded-2xl border border-[#1e2540] overflow-hidden h-full">
      <div className="px-5 pt-5 pb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-0.5 flex-wrap">
            <span className="font-mono text-[9px] text-[#3a4a6a] tracking-[0.3em] uppercase">Section 03</span>
            <span className="font-body text-sm font-semibold text-[#a0b0cc]">Sales Trend</span>
            <span className="font-mono text-[8px] px-2 py-0.5 rounded-md bg-[#3ecfff]/10 text-[#3ecfff] border border-[#3ecfff]/20 tracking-wider uppercase">
              {isExcelExportRange ? 'Excel' : isCurrentMonthDaily ? 'Daily' : 'Monthly'}
            </span>
          </div>
        </div>
        {!isExcelExportRange ? (
          <div className="flex gap-4 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-[3px] rounded-full bg-[#f87171]" />
              <span className="font-mono text-[10px] text-[#5a6a8a]">Transactions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-[3px] rounded-full bg-[#818cf8]" />
              <span className="font-mono text-[10px] text-[#5a6a8a]">Revenue</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-5 pb-3 flex flex-col gap-2 border-b border-[#1e2540]/80">
        <div className="flex items-center gap-2 font-mono text-[9px] text-[#5a6a8a] uppercase tracking-wider">
          <CalendarRange size={12} className="text-[#3ecfff]/80 shrink-0" aria-hidden />
          <span>History window</span>
          {fetchLoading ? <Loader2 size={12} className="animate-spin text-[#3ecfff] ml-1" aria-hidden /> : null}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sales history range">
          {RANGE_PRESETS.map((p) => {
            const active = salesRange === p.id;
            return (
              <button
                key={String(p.id)}
                type="button"
                onClick={() => setSalesRange(p.id)}
                title={p.label}
                className={[
                  'px-2.5 py-1.5 rounded-lg font-mono text-[10px] tracking-wide transition-colors border',
                  active
                    ? 'bg-[#3ecfff]/15 text-[#3ecfff] border-[#3ecfff]/35'
                    : 'bg-[#0c0f1a]/80 text-[#5a6a8a] border-[#1e2540] hover:text-[#a0b0cc] hover:border-[#2a3555]',
                ].join(' ')}
              >
                {p.short}
              </button>
            );
          })}
        </div>
        {fetchError ? (
          <p className="font-mono text-[10px] text-amber-400/95 leading-snug">{fetchError}</p>
        ) : null}
      </div>

      {showExportSkeleton && (
        <div className="px-2 h-[280px] flex items-center justify-center">
          <div className="w-full h-48 bg-[#0c0f1a] rounded-xl animate-pulse" />
        </div>
      )}
      {!showExportSkeleton && isExcelExportRange && (
        <div className="px-5 pb-8 pt-6 min-h-[280px] flex flex-col items-center justify-center gap-4 text-center">
          {chartDaily.length === 0 ? (
            <p className="font-body text-sm text-[#5a6a8a] max-w-md">
              No daily sales rows in this range. Run ETL for <span className="font-mono text-[#a0b0cc]">gold.fact_sales</span> or pick
              another window.
            </p>
          ) : (
            <>
              <FileDown className="w-11 h-11 text-[#3ecfff]/85" aria-hidden />
              <p className="font-body text-sm text-[#a0b0cc] max-w-md leading-relaxed">
                For <span className="text-[#e0e8f5] font-medium">2 yr</span> and{' '}
                <span className="text-[#e0e8f5] font-medium">All</span>, the graph is replaced with an Excel export: one sheet of daily
                rows (<span className="font-mono text-[11px]">Date</span>, <span className="font-mono text-[11px]">Transactions</span>,{' '}
                <span className="font-mono text-[11px]">Revenue</span>). A download starts automatically when data is ready.
              </p>
              <p className="font-mono text-[10px] text-[#5a6a8a]">
                {chartDaily.length.toLocaleString()} day{chartDaily.length === 1 ? '' : 's'} in file
              </p>
              <button
                type="button"
                onClick={() =>
                  downloadSalesDailyAsExcel(chartDaily, salesRange === 730 ? '2-years' : 'all-time')
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[11px] font-bold uppercase tracking-wide bg-[#3ecfff]/15 text-[#3ecfff] border border-[#3ecfff]/35 hover:bg-[#3ecfff]/25 transition-colors"
              >
                <FileDown size={14} aria-hidden />
                Download Excel again
              </button>
            </>
          )}
        </div>
      )}
      {showChartSkeleton && (
        <div className="px-2 h-[280px] flex items-center justify-center">
          <div className="w-full h-48 bg-[#0c0f1a] rounded-xl animate-pulse" />
        </div>
      )}
      {!showExportSkeleton && !isExcelExportRange && !showChartSkeleton && !hasChartData && (
        <div className="px-5 pb-6 pt-2">
          <div className="py-10 text-center font-body text-sm text-[#5a6a8a]">
            No sales in this range. Try a longer window or run ETL for `gold.fact_sales`.
          </div>
        </div>
      )}
      {!isExcelExportRange && hasChartData && (
        <>
          <div className="px-2">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}>
              <text
                x={PL}
                y={PY - 10}
                textAnchor="start"
                fill="#6a7a9a"
                style={{ fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.06em' }}
              >
                Transactions
              </text>
              <text
                x={W - PR}
                y={PY - 10}
                textAnchor="end"
                fill="#6a7a9a"
                style={{ fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.06em' }}
              >
                Revenue
              </text>
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const ph = H - PY * 2;
                const y = H - PY - pct * ph;
                return (
                  <g key={pct}>
                    <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    <text
                      x={PL - 6}
                      y={y + 3}
                      textAnchor="end"
                      fill="#f87171"
                      fillOpacity={0.65}
                      style={{ fontSize: '9px', fontFamily: 'Space Mono' }}
                    >
                      {formatOrdersAxisTick(maxSales * pct)}
                    </text>
                    <text
                      x={W - PR + 6}
                      y={y + 3}
                      textAnchor="start"
                      fill="#818cf8"
                      fillOpacity={0.75}
                      style={{ fontSize: '9px', fontFamily: 'Space Mono' }}
                    >
                      {formatRevenueAxisTick(revAxisMax * pct)}
                    </text>
                  </g>
                );
              })}
              <defs>
                <linearGradient id={fillGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#f87171" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              <g key={chartAnimKey}>
                {salesArea ? <path d={salesArea} fill={`url(#${fillGradId})`} /> : null}
                <motion.path
                  key={`${chartAnimKey}-sales`}
                  d={salesPath}
                  fill="none"
                  stroke="#f87171"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.85 }}
                />
                <motion.path
                  key={`${chartAnimKey}-rev`}
                  d={revPath}
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6 4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.85, delay: 0.12 }}
                />
              </g>
              {chartData.map((d, i) => {
                const ph = H - PY * 2;
                const x = n === 1 ? PL + plotW / 2 : PL + i * step;
                const ySales = H - PY - (d.sales / maxSales) * ph;
                const yRev = H - PY - (d.revenue / revAxisMax) * ph;
                const bandW = n === 1 ? plotW : step;
                return (
                  <g key={`${d.monthKey}-${i}`} onMouseEnter={() => setHover(i)}>
                    <rect x={x - bandW / 2} y={0} width={bandW} height={H} fill="transparent" />
                    {hover === i && (
                      <line
                        x1={x}
                        y1={PY}
                        x2={x}
                        y2={H - PY}
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                    )}
                    <circle cx={x} cy={ySales} r={hover === i ? 5 : 3} fill="#f87171" stroke="#111628" strokeWidth="2" />
                    <circle cx={x} cy={yRev} r={hover === i ? 5 : 3} fill="#818cf8" stroke="#111628" strokeWidth="2" />
                    <text
                      x={x}
                      y={H - PY + 18}
                      textAnchor="middle"
                      fill="#4a5a7a"
                      style={{ fontSize: '9px', fontFamily: 'Space Mono' }}
                    >
                      {isCurrentMonthDaily
                        ? String(parseChartDay(d.monthKey)?.getDate() ?? '')
                        : formatMonthTick(d.monthKey, monthKeys)}
                    </text>
                  </g>
                );
              })}
              {hover !== null &&
                (() => {
                  const d = chartData[hover];
                  const xHover = n === 1 ? PL + plotW / 2 : PL + hover * step;
                  const x = Math.min(Math.max(xHover, PL + 78), W - PR - 78);
                  return (
                    <g>
                      <rect
                        x={x - 72}
                        y={8}
                        width={144}
                        height={56}
                        rx={8}
                        fill="#0c0f1a"
                        fillOpacity="0.95"
                        stroke="#1e2540"
                        strokeWidth="1"
                      />
                      <text
                        x={x}
                        y={26}
                        textAnchor="middle"
                        fill="#e0e8f5"
                        style={{ fontSize: '11px', fontFamily: 'Outfit', fontWeight: 600 }}
                      >
                        {d.date}
                      </text>
                      <text
                        x={x}
                        y={42}
                        textAnchor="middle"
                        fill="#a0b0cc"
                        style={{ fontSize: '9px', fontFamily: 'Space Mono' }}
                      >
                        transactions · revenue
                      </text>
                      <text
                        x={x - 34}
                        y={56}
                        textAnchor="middle"
                        fill="#f87171"
                        style={{ fontSize: '10px', fontFamily: 'Space Mono' }}
                      >
                        {d.sales.toLocaleString()}
                      </text>
                      <text
                        x={x + 34}
                        y={56}
                        textAnchor="middle"
                        fill="#818cf8"
                        style={{ fontSize: '10px', fontFamily: 'Space Mono' }}
                      >
                        $
                        {d.revenue.toLocaleString(undefined, {
                          maximumFractionDigits: d.revenue >= 1000 ? 0 : 2,
                        })}
                      </text>
                    </g>
                  );
                })()}
            </svg>
          </div>
          <div className="px-5 py-3 border-t border-[#1e2540] flex flex-wrap gap-6">
            <div>
              <span className="font-mono text-[9px] text-[#3a4a6a] tracking-widest uppercase">
                {isCurrentMonthDaily ? 'Peak day (transactions)' : 'Peak month (transactions)'}
              </span>
              <p className="font-body text-lg font-bold text-[#e0e8f5]">
                {peakSales.sales.toLocaleString()}{' '}
                <span className="font-mono text-[10px] text-[#4a5a7a]">{peakSales.date}</span>
              </p>
            </div>
            <div>
              <span className="font-mono text-[9px] text-[#3a4a6a] tracking-widest uppercase">
                {isCurrentMonthDaily ? 'Peak day (revenue)' : 'Peak month (revenue)'}
              </span>
              <p className="font-body text-lg font-bold text-[#818cf8]">
                ${peakRevenue.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                <span className="font-mono text-[10px] text-[#4a5a7a]">{peakRevenue.date}</span>
              </p>
            </div>
            <div>
              <span className="font-mono text-[9px] text-[#3a4a6a] tracking-widest uppercase">
                {isCurrentMonthDaily ? 'Avg / day (transactions)' : 'Avg / month'}
              </span>
              <p className="font-body text-lg font-bold text-[#e0e8f5]">
                {avgPerDayOrMonth.toLocaleString()} transactions
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
