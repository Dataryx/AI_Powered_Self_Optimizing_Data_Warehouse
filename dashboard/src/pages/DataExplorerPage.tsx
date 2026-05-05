import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Table2, Layers, Code2, ChevronLeft, Radio, MapPin, Hash, Clock, X, Copy, Check, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SidebarPageShell from '../components/SidebarPageShell';
import MobileMenuButton from '../components/MobileMenuButton';
import { api } from '../services/api';
import { formatLocalTime } from '../utils/time';

type Layer = 'Bronze' | 'Silver' | 'Gold';

interface TableInfo {
  name: string;
  layer: Layer;
  columns: number;
  updated: string;
}

type TableColumnsPayload = {
  columns?: Array<{ name: string; type: string }>;
};

const allTables: TableInfo[] = [
  // Bronze - 16 tables
  { name: 'country', layer: 'Bronze', columns: 8, updated: 'Unknown' },
  { name: 'customer', layer: 'Bronze', columns: 8, updated: 'Unknown' },
  { name: 'customer_company', layer: 'Bronze', columns: 7, updated: 'Unknown' },
  { name: 'customer_employee', layer: 'Bronze', columns: 10, updated: 'Unknown' },
  { name: 'employment', layer: 'Bronze', columns: 12, updated: 'Unknown' },
  { name: 'employment_jobs', layer: 'Bronze', columns: 8, updated: 'Unknown' },
  { name: 'inventory', layer: 'Bronze', columns: 8, updated: 'Unknown' },
  { name: 'location', layer: 'Bronze', columns: 15, updated: 'Unknown' },
  { name: 'order_item', layer: 'Bronze', columns: 8, updated: 'Unknown' },
  { name: 'orders', layer: 'Bronze', columns: 12, updated: 'Unknown' },
  { name: 'person', layer: 'Bronze', columns: 11, updated: 'Unknown' },
  { name: 'person_location', layer: 'Bronze', columns: 8, updated: 'Unknown' },
  { name: 'phone_number', layer: 'Bronze', columns: 9, updated: 'Unknown' },
  { name: 'product', layer: 'Bronze', columns: 15, updated: 'Unknown' },
  { name: 'restricted_info', layer: 'Bronze', columns: 10, updated: 'Unknown' },
  { name: 'warehouse', layer: 'Bronze', columns: 6, updated: 'Unknown' },
  // Silver - 16 tables
  { name: 'country', layer: 'Silver', columns: 8, updated: 'Unknown' },
  { name: 'customer', layer: 'Silver', columns: 8, updated: 'Unknown' },
  { name: 'customer_company', layer: 'Silver', columns: 7, updated: 'Unknown' },
  { name: 'customer_employee', layer: 'Silver', columns: 10, updated: 'Unknown' },
  { name: 'employment', layer: 'Silver', columns: 12, updated: 'Unknown' },
  { name: 'employment_jobs', layer: 'Silver', columns: 8, updated: 'Unknown' },
  { name: 'inventory', layer: 'Silver', columns: 8, updated: 'Unknown' },
  { name: 'location', layer: 'Silver', columns: 15, updated: 'Unknown' },
  { name: 'order_item', layer: 'Silver', columns: 8, updated: 'Unknown' },
  { name: 'orders', layer: 'Silver', columns: 12, updated: 'Unknown' },
  { name: 'person', layer: 'Silver', columns: 11, updated: 'Unknown' },
  { name: 'person_location', layer: 'Silver', columns: 8, updated: 'Unknown' },
  { name: 'phone_number', layer: 'Silver', columns: 9, updated: 'Unknown' },
  { name: 'product', layer: 'Silver', columns: 15, updated: 'Unknown' },
  { name: 'restricted_info', layer: 'Silver', columns: 10, updated: 'Unknown' },
  { name: 'warehouse', layer: 'Silver', columns: 6, updated: 'Unknown' },
  // Gold - 14 tables
  { name: 'fact_sales', layer: 'Gold', columns: 12, updated: 'Unknown' },
  { name: 'fact_orders', layer: 'Gold', columns: 10, updated: 'Unknown' },
  { name: 'dim_customer', layer: 'Gold', columns: 14, updated: 'Unknown' },
  { name: 'dim_product', layer: 'Gold', columns: 11, updated: 'Unknown' },
  { name: 'dim_location', layer: 'Gold', columns: 9, updated: 'Unknown' },
  { name: 'dim_date', layer: 'Gold', columns: 8, updated: 'Unknown' },
  { name: 'dim_warehouse', layer: 'Gold', columns: 6, updated: 'Unknown' },
  { name: 'dim_employee', layer: 'Gold', columns: 10, updated: 'Unknown' },
  { name: 'agg_customer_lifetime', layer: 'Gold', columns: 8, updated: 'Unknown' },
  { name: 'agg_product_performance', layer: 'Gold', columns: 9, updated: 'Unknown' },
  { name: 'agg_monthly_sales', layer: 'Gold', columns: 7, updated: 'Unknown' },
  { name: 'agg_daily_revenue', layer: 'Gold', columns: 6, updated: 'Unknown' },
  { name: 'agg_warehouse_inventory', layer: 'Gold', columns: 8, updated: 'Unknown' },
  { name: 'agg_regional_sales', layer: 'Gold', columns: 7, updated: 'Unknown' },
];

const layerConfig: Record<Layer, { icon: React.ElementType; accent: string; bg: string; border: string; badge: string; badgeText: string; count: number; dotBg: string }> = {
  Bronze: {
    icon: Table2,
    accent: 'text-topo-bronze',
    bg: 'bg-topo-bronze/6',
    border: 'border-topo-bronze/15',
    badge: 'bg-topo-bronze',
    badgeText: 'text-white',
    count: 16,
    dotBg: 'bg-topo-bronze',
  },
  Silver: {
    icon: Layers,
    accent: 'text-topo-silver',
    bg: 'bg-topo-silver/6',
    border: 'border-topo-silver/15',
    badge: 'bg-topo-silver',
    badgeText: 'text-white',
    count: 16,
    dotBg: 'bg-topo-silver',
  },
  Gold: {
    icon: Code2,
    accent: 'text-topo-gold',
    bg: 'bg-topo-gold/6',
    border: 'border-topo-gold/15',
    badge: 'bg-topo-gold',
    badgeText: 'text-white',
    count: 14,
    dotBg: 'bg-topo-gold',
  },
};

const layers: Layer[] = ['Bronze', 'Silver', 'Gold'];

function formatBytes(bytes: number | undefined | null): string {
  if (bytes == null || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / k ** i).toFixed(i ? 2 : 0)} ${sizes[i]}`;
}

export default function DataExplorerPage() {
  const navigate = useNavigate();
  const [activeLayer, setActiveLayer] = useState<Layer>('Bronze');
  const [search, setSearch] = useState('');
  const [time, setTime] = useState(new Date());
  const [tables, setTables] = useState<TableInfo[]>(allTables);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tableStats, setTableStats] = useState<Awaited<ReturnType<typeof api.getTableStats>> | null>(null);
  const [tableColumnsMeta, setTableColumnsMeta] = useState<TableColumnsPayload | null>(null);
  const [copiedFqn, setCopiedFqn] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const schemasRes = await import('../services/api').then((m) => m.api.getSchemas());
        const rawList = Array.isArray(schemasRes) ? schemasRes : (schemasRes as any)?.schemas ?? ['bronze', 'silver', 'gold'];
        const schemaList: string[] = rawList.map((s: any) =>
          typeof s === 'string' ? s : (s?.name ?? s?.schema ?? s?.value ?? String(s))
        ).filter(Boolean);
        const layerMap: Record<string, Layer> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
        const result: TableInfo[] = [];
        for (const schemaName of schemaList) {
          const layer = layerMap[schemaName?.toLowerCase?.()] ?? 'Bronze';
          try {
            const tablesRes = await import('../services/api').then((m) => m.api.getTables(schemaName));
            const rawNames = Array.isArray(tablesRes) ? tablesRes : (tablesRes as any)?.tables ?? [];
            const names = rawNames.map((n: any) => typeof n === 'string' ? n : (n?.name ?? n?.table_name ?? String(n)));
            for (const name of names) {
              let columns = 8;
              let updated = 'Unknown';
              try {
                const stats = await import('../services/api').then((m) => m.api.getTableStats(schemaName, name));
                columns = (stats as any)?.columns ?? 8;
                updated = (stats as any)?.updated ?? 'Unknown';
              } catch (_) {}
              result.push({ name: String(name), layer, columns, updated });
            }
          } catch (_) {}
        }
        if (!cancelled && result.length > 0) setTables(result);
      } catch (_) {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return tables
      .filter(t => t.layer === activeLayer)
      .filter(t => search === '' || t.name.toLowerCase().includes(search.toLowerCase()));
  }, [activeLayer, search, tables]);

  const cfg = layerConfig[activeLayer];
  const layerCounts = useMemo(() => ({
    Bronze: tables.filter(t => t.layer === 'Bronze').length,
    Silver: tables.filter(t => t.layer === 'Silver').length,
    Gold: tables.filter(t => t.layer === 'Gold').length,
  }), [tables]);

  const loadTableDetails = async (table: TableInfo) => {
    setDetailLoading(true);
    setTableStats(null);
    setTableColumnsMeta(null);
    setCopiedFqn(false);
    try {
      const schema = table.layer.toLowerCase();
      const [statsResult, columnsResult] = await Promise.allSettled([
        api.getTableStats(schema, table.name),
        // limit=0: column metadata only, no sample rows
        api.getTableData(schema, table.name, 0, 0),
      ]);
      if (statsResult.status === 'fulfilled') setTableStats(statsResult.value);
      else setTableStats(null);
      if (columnsResult.status === 'fulfilled') {
        const payload = columnsResult.value as TableColumnsPayload & { columns?: Array<{ name: string; type: string }> };
        setTableColumnsMeta({ columns: payload.columns });
      } else setTableColumnsMeta(null);
    } catch {
      setTableStats(null);
      setTableColumnsMeta(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenTable = (table: TableInfo) => {
    setSelectedTable(table);
    void loadTableDetails(table);
  };

  const closeDetailModal = () => {
    setSelectedTable(null);
    setTableStats(null);
    setTableColumnsMeta(null);
    setCopiedFqn(false);
  };

  const copyQualifiedName = () => {
    if (!selectedTable) return;
    const q = `${selectedTable.layer.toLowerCase()}.${selectedTable.name}`;
    void navigator.clipboard?.writeText(q).then(() => {
      setCopiedFqn(true);
      setTimeout(() => setCopiedFqn(false), 2000);
    });
  };

  return (
    <>
    <SidebarPageShell className="bg-base topo-bg">
        {/* Header */}
        <header className="min-h-14 border-b border-contour-strong bg-surface/80 backdrop-blur-xl flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2 sm:py-0 sticky top-0 z-40">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <MobileMenuButton />
            <button onClick={() => navigate('/')} className="flex items-center gap-1 text-ink-muted hover:text-ink transition-colors shrink-0">
              <ChevronLeft size={16} />
              <span className="font-mono text-[11px] tracking-wider">Home</span>
            </button>
            <span className="text-ink-faint">/</span>
            <span className="font-body text-sm font-semibold text-ink truncate">Data Explorer</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-topo-4/10 border border-topo-4/20">
              <Radio size={10} className="text-topo-4 animate-pulse" />
              <span className="font-mono text-[9px] text-topo-4 font-bold tracking-widest uppercase">Live</span>
            </div>
            <span className="font-mono text-xs text-ink-soft tabular-nums">
              {formatLocalTime(time)}
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 pb-12 max-w-7xl mx-auto w-full">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h1 className="font-body text-2xl sm:text-3xl font-bold text-ink tracking-tight">Data Explorer</h1>
            <p className="font-body text-sm text-ink-muted mt-1">Browse schemas and metadata across warehouse layers</p>
          </motion.div>

          {/* Layer Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center mb-5"
          >
            {layers.map((layer) => {
              const lc = layerConfig[layer];
              const Icon = lc.icon;
              const isActive = activeLayer === layer;
              return (
                <button
                  key={layer}
                  onClick={() => setActiveLayer(layer)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-body text-sm font-semibold transition-all duration-250 ${
                    isActive
                      ? `${lc.badge} ${lc.badgeText} shadow-lg shadow-${layer.toLowerCase()}/20`
                      : 'bg-surface border border-contour-strong text-ink-soft hover:text-ink hover:border-contour-strong hover:bg-surface-alt'
                  }`}
                >
                  <Icon size={15} />
                  <span>{layer}</span>
                  <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-white/20' : 'bg-base'
                  }`}>
                    {layerCounts[layer]}
                  </span>
                </button>
              );
            })}

            <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto pt-1 sm:pt-0 border-t border-contour/40 sm:border-0">
              <span className="font-mono text-[9px] text-ink-faint tracking-widest uppercase">Total</span>
              <span className="font-body text-sm font-bold text-ink">{tables.length} tables</span>
            </div>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative mb-6"
          >
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              placeholder="Search tables and columns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface border border-contour-strong rounded-xl pl-11 pr-4 py-3 font-body text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-topo-5/20 focus:border-topo-5/30 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors font-mono text-xs"
              >
                Clear
              </button>
            )}
          </motion.div>

          {/* Results count */}
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={12} className={cfg.accent} />
            <span className="font-mono text-[10px] text-ink-muted tracking-wider">
              {loading ? 'Loading tables…' : <>Showing <span className="font-bold text-ink">{filtered.length}</span> tables in <span className={`font-bold ${cfg.accent}`}>{activeLayer}</span> layer</>}
            </span>
          </div>

          {/* Table Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((table, i) => (
                <motion.div
                  key={`${table.layer}-${table.name}`}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.025, duration: 0.3 }}
                  className={`group bg-surface rounded-2xl border ${cfg.border} hover:border-contour-strong p-5 cursor-pointer transition-all duration-250 hover:shadow-lg hover:shadow-ink/[0.03] relative overflow-hidden`}
                  onClick={() => handleOpenTable(table)}
                >
                  {/* Hover contour decoration */}
                  <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full border border-contour opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
                  <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full border border-contour opacity-0 group-hover:opacity-30 transition-opacity duration-500" />

                  {/* Table name */}
                  <div className="relative">
                    <h3 className={`font-body text-base font-bold text-ink group-hover:${cfg.accent} transition-colors mb-2 truncate`}>
                      {table.name}
                    </h3>

                    {/* Layer badge */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider ${cfg.badge} ${cfg.badgeText}`}>
                      {table.layer}
                    </span>

                    {/* Stats */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Hash size={11} className="text-ink-faint" />
                          <span className="font-mono text-[11px] text-ink-muted">Columns</span>
                        </div>
                        <span className="font-body text-sm font-bold text-ink">{table.columns}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <Clock size={11} className="text-ink-faint" />
                          <span className="font-mono text-[11px] text-ink-muted">Updated</span>
                        </div>
                        <span
                          className="font-mono text-[11px] text-ink-faint text-right break-words leading-tight max-w-[56%]"
                          title={table.updated}
                        >
                          {table.updated}
                        </span>
                      </div>
                    </div>

                    {/* Column density bar */}
                    <div className="mt-3 pt-3 border-t border-contour">
                      <div className="h-1 bg-base rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(table.columns / 15) * 100}%` }}
                          transition={{ delay: i * 0.025 + 0.3, duration: 0.4 }}
                          className={`h-full rounded-full ${cfg.dotBg}`}
                          style={{ opacity: 0.5 }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="w-14 h-14 rounded-full bg-surface-alt border border-contour-strong flex items-center justify-center mb-4">
                <Search size={22} className="text-ink-faint" />
              </div>
              <span className="font-body text-base text-ink-muted">No tables found matching "{search}"</span>
              <button onClick={() => setSearch('')} className="mt-2 font-mono text-[11px] text-topo-5 font-bold hover:underline">Clear search</button>
            </motion.div>
          )}

          {/* Footer info */}
          <div className="mt-8 mb-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 px-1">
            {layers.map(l => {
              const lc = layerConfig[l];
              return (
                <div key={l} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${lc.dotBg}`} />
                  <span className="font-mono text-[10px] text-ink-muted">{l}: <span className="font-bold text-ink">{layerCounts[l]}</span></span>
                </div>
              );
            })}
            <div className="h-3 w-px bg-contour-strong" />
            <span className="font-mono text-[10px] text-ink-faint">Total: <span className="font-bold text-ink">{tables.length} tables</span></span>
          </div>
        </main>
    </SidebarPageShell>

      <AnimatePresence>
        {selectedTable && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDetailModal}
          >
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-contour-strong bg-surface shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-contour shrink-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Database size={18} className="text-ink-faint shrink-0" />
                    <h3 className="font-body text-lg font-bold text-ink truncate">
                      {selectedTable.layer.toLowerCase()}.{selectedTable.name}
                    </h3>
                    <button
                      type="button"
                      onClick={copyQualifiedName}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-contour text-ink-muted hover:text-ink hover:bg-surface-alt font-mono text-[10px] shrink-0"
                    >
                      {copiedFqn ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      {copiedFqn ? 'Copied' : 'Copy name'}
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-ink-muted">
                    Medallion layer: <span className="text-ink font-semibold">{selectedTable.layer}</span>
                    {' · '}
                    Card snapshot: {selectedTable.columns} cols, updated {selectedTable.updated}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDetailModal}
                  className="p-2 rounded-lg hover:bg-surface-alt text-ink-muted hover:text-ink transition-colors shrink-0"
                  aria-label="Close details"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 min-h-0">
                {detailLoading && (
                  <div className="font-mono text-xs text-ink-muted py-8 text-center">Loading table details…</div>
                )}

                {!detailLoading && !tableStats && !tableColumnsMeta && (
                  <div className="font-mono text-xs text-ink-muted py-6">
                    Could not load details for this table. Check the API and that the table exists.
                  </div>
                )}

                {!detailLoading && tableStats && (
                  <section className="mb-6">
                    <h4 className="font-body text-sm font-bold text-ink mb-3">Overview</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-contour bg-surface-alt/50 p-3">
                        <span className="font-mono text-[9px] text-ink-faint uppercase tracking-wider">Exact row count</span>
                        <p className="font-body text-lg font-bold text-ink tabular-nums mt-1">
                          {(tableStats.row_count ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-xl border border-contour bg-surface-alt/50 p-3">
                        <span className="font-mono text-[9px] text-ink-faint uppercase tracking-wider">Live rows (est.)</span>
                        <p className="font-body text-lg font-bold text-ink tabular-nums mt-1">
                          {tableStats.n_live_tup != null ? tableStats.n_live_tup.toLocaleString() : '—'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-contour bg-surface-alt/50 p-3">
                        <span className="font-mono text-[9px] text-ink-faint uppercase tracking-wider">Columns</span>
                        <p className="font-body text-lg font-bold text-ink tabular-nums mt-1">{tableStats.columns ?? '—'}</p>
                      </div>
                      <div className="rounded-xl border border-contour bg-surface-alt/50 p-3">
                        <span className="font-mono text-[9px] text-ink-faint uppercase tracking-wider">Total size</span>
                        <p className="font-body text-sm font-bold text-ink mt-1 leading-tight">
                          {tableStats.size ?? formatBytes(tableStats.size_bytes ?? 0)}
                        </p>
                        {tableStats.size_bytes != null && tableStats.size_bytes > 0 && (
                          <p className="font-mono text-[10px] text-ink-faint mt-0.5 tabular-nums">
                            {tableStats.size_bytes.toLocaleString()} bytes
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-contour bg-base/40 p-3 space-y-1.5">
                      <p className="font-mono text-[10px] text-ink-muted">
                        <span className="text-ink-faint">Last stats activity: </span>
                        {tableStats.updated ?? 'Unknown'}
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2 font-mono text-[10px] text-ink-muted">
                        <span title={tableStats.last_vacuum ?? ''}>
                          Vacuum: {tableStats.last_vacuum ?? '—'}
                        </span>
                        <span title={tableStats.last_autovacuum ?? ''}>
                          Autovacuum: {tableStats.last_autovacuum ?? '—'}
                        </span>
                        <span title={tableStats.last_analyze ?? ''}>
                          Analyze: {tableStats.last_analyze ?? '—'}
                        </span>
                        <span title={tableStats.last_autoanalyze ?? ''}>
                          Autoanalyze: {tableStats.last_autoanalyze ?? '—'}
                        </span>
                      </div>
                    </div>
                  </section>
                )}

                {!detailLoading && tableColumnsMeta?.columns && tableColumnsMeta.columns.length > 0 && (
                  <section className="mb-6">
                    <h4 className="font-body text-sm font-bold text-ink mb-3">Column definitions</h4>
                    <div className="overflow-auto border border-contour rounded-xl max-h-[min(50vh,28rem)]">
                      <table className="min-w-full text-sm">
                        <thead className="bg-surface-alt border-b border-contour sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-mono text-[11px] text-ink-muted">#</th>
                            <th className="px-3 py-2 text-left font-mono text-[11px] text-ink-muted">Name</th>
                            <th className="px-3 py-2 text-left font-mono text-[11px] text-ink-muted">Data type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableColumnsMeta.columns.map((col, i) => (
                            <tr key={col.name} className="border-b border-contour/60 last:border-b-0">
                              <td className="px-3 py-1.5 font-mono text-[11px] text-ink-faint">{i + 1}</td>
                              <td className="px-3 py-1.5 font-mono text-[11px] text-ink font-medium">{col.name}</td>
                              <td className="px-3 py-1.5 font-mono text-[11px] text-ink-muted">{col.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
