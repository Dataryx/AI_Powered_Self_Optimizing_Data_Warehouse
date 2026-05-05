import * as XLSX from 'xlsx';

export type SalesDailyRow = {
  date?: string;
  count?: number;
  sales?: number;
  revenue?: number;
  [key: string]: unknown;
};

function rowDateRaw(row: SalesDailyRow): unknown {
  return row.date ?? row.sale_date ?? row.order_date ?? row.date_key;
}

function toFiniteNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

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

function isoFromDate(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/**
 * Build a `.xlsx` from daily sales rows (same shape as `/warehouse/sales-stats` `daily_sales`).
 */
export function downloadSalesDailyAsExcel(rows: SalesDailyRow[], fileTag: string): void {
  const sorted = [...rows]
    .filter((r) => parseChartDay(rowDateRaw(r)) != null)
    .sort((a, b) => {
      const da = parseChartDay(rowDateRaw(a))!.getTime();
      const db = parseChartDay(rowDateRaw(b))!.getTime();
      return da - db;
    });

  const sheetRows = sorted.map((row) => {
    const dt = parseChartDay(rowDateRaw(row))!;
    const r = row as Record<string, unknown>;
    return {
      Date: isoFromDate(dt),
      Orders: toFiniteNumber(row.count ?? row.sales ?? r.sales_count),
      Revenue: toFiniteNumber(row.revenue ?? r.net_amount),
    };
  });

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daily sales');

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const safeTag = fileTag.replace(/[^a-z0-9-_]+/gi, '-').slice(0, 40);
  XLSX.writeFile(wb, `sales-trend-${safeTag}-${stamp}.xlsx`);
}
