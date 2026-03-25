import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Zap, AlertCircle } from 'lucide-react';

const CACHE_PAGE_SIZE = 6;

function getCacheFromApi(data: any): { overallHitRate: number; topTables: { name: string; pct: number }[]; tableDetails: { name: string; hitRate: string; hits: string; diskReads: string; tag: string }[] } {
  const cache = data?.cache;
  if (!cache) {
    return { overallHitRate: 0, topTables: [], tableDetails: [] };
  }
  const overall = cache.overall ?? {};
  const overallHitRate = Number(overall.hit_rate) ?? 0;
  const tables = Array.isArray(cache.tables) ? cache.tables : [];
  const topTables = tables.slice(0, 8).map((t: any) => {
    const raw = t.table ?? '';
    const name = raw.replace(/^[^.]+\./, '') || raw || '?';
    return { name, pct: Number(t.hit_rate) ?? 0 };
  });
  const tableDetails = tables.map((t: any) => {
    const raw = t.table ?? '';
    const name = raw.replace(/^[^.]+\./, '') || raw || '?';
    return {
      name,
      hitRate: `${Number(t.hit_rate ?? 0).toFixed(1)}%`,
      hits: Number(t.cache_hits ?? 0).toLocaleString(),
      diskReads: Number(t.disk_reads ?? 0).toLocaleString(),
      tag: t.status ?? 'fair',
    };
  });
  return { overallHitRate, topTables, tableDetails };
}

interface CachePerformanceProps { data?: any; loading?: boolean }

export default function CachePerformance({ data, loading }: CachePerformanceProps) {
  const { overallHitRate, topTables, tableDetails } = getCacheFromApi(data);
  const [page, setPage] = useState(1);
  const totalPages = tableDetails.length > 0 ? Math.max(1, Math.ceil(tableDetails.length / CACHE_PAGE_SIZE)) : 1;
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * CACHE_PAGE_SIZE;
  const pageTableDetails = tableDetails.slice(startIndex, startIndex + CACHE_PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages);
  }, [totalPages, page]);
  return (
    <div className="bg-surface rounded-2xl border border-contour-strong overflow-hidden h-full">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-topo-2/10 flex items-center justify-center">
            <Zap size={16} className="text-topo-2" />
          </div>
          <div>
            <h3 className="font-body text-base font-bold text-ink">Cache Performance</h3>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">Updated: 6:52:23 PM</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-ink-faint">Overall Hit Rate</span>
          <span className="font-body text-base font-bold text-topo-4">{loading && !data?.cache ? '…' : `${overallHitRate.toFixed(1)}%`}</span>
        </div>
      </div>

      <div className="px-5 pb-5">
        {/* Two column: donut + bar */}
        <div className="grid grid-cols-2 gap-6 mb-5">
          <div>
            <h4 className="font-body text-sm font-semibold text-ink mb-3">Cache Hits vs Disk Reads</h4>
            <div className="flex items-center gap-4">
              {/* Simple donut */}
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                <motion.circle
                  cx="50" cy="50" r="38"
                  fill="none" stroke="#7ab648" strokeWidth="12"
                  strokeDasharray={`${(overallHitRate / 100) * 2 * Math.PI * 38} ${2 * Math.PI * 38}`}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />
                <text x="50" y="46" textAnchor="middle" className="fill-topo-4" style={{ fontSize: '10px', fontFamily: 'Space Mono', fontWeight: 700 }}>Cache Hits</text>
                <text x="50" y="58" textAnchor="middle" className="fill-ink" style={{ fontSize: '8px', fontFamily: 'Space Mono' }}>7x</text>
              </svg>
              <div>
                <div className="font-body text-2xl font-bold text-ink">{((100 - overallHitRate) / 100 * 100).toFixed(1)}%</div>
                <div className="font-mono text-[10px] text-ink-muted">Disk reads share</div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-body text-sm font-semibold text-ink mb-3">Top Tables by Hit Rate</h4>
            {loading && !tableDetails.length && <p className="font-mono text-[10px] text-ink-faint">Loading…</p>}
            <div className="space-y-1">
              {(topTables.length ? topTables : [{ name: '—', pct: 0 }]).map((t, i) => (
                <div key={t.name} className="flex items-center gap-2">
                  <span className="font-mono text-[8px] text-ink-faint w-[80px] text-right truncate">{t.name}</span>
                  <div className="flex-1 h-2 bg-base rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${t.pct}%` }}
                      transition={{ delay: i * 0.05 + 0.4, duration: 0.4 }}
                      className="h-full rounded-full"
                      style={{ background: `hsl(${120 + i * 30}, 60%, 50%)`, opacity: 0.7 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {/* X-axis */}
            <div className="flex justify-between mt-1 ml-[88px]">
              {['0%', '25%', '50%', '75%', '100%'].map(l => (
                <span key={l} className="font-mono text-[7px] text-ink-faint">{l}</span>
              ))}
            </div>
          </div>
        </div>

        <p className="font-mono text-[9px] text-ink-faint italic mb-4">Low hit rates may indicate missing partitions or skewed access patterns.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {(pageTableDetails.length ? pageTableDetails : []).map((t, i) => (
            <motion.div
              key={`${t.name}-${startIndex + i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 + 0.5 }}
              className="bg-base/50 rounded-xl p-3 border border-contour"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-body text-xs font-semibold text-ink truncate mr-2">{t.name}</span>
                <AlertCircle size={12} className="text-topo-1 shrink-0" />
              </div>
              <div className="flex items-center gap-1 mb-1">
                <span className="font-mono text-[8px] text-white bg-topo-1 px-1.5 py-0.5 rounded">{t.tag}</span>
              </div>
              <div className="space-y-1 mt-2">
                <div className="flex justify-between">
                  <span className="font-mono text-[9px] text-ink-faint">Hit Rate</span>
                  <span className="font-mono text-[10px] font-bold text-ink">{t.hitRate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[9px] text-ink-faint">Hits</span>
                  <span className="font-mono text-[9px] text-ink-muted">{t.hits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[9px] text-ink-faint">Disk Reads</span>
                  <span className="font-mono text-[9px] text-ink-muted">{t.diskReads}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {tableDetails.length > CACHE_PAGE_SIZE && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[10px] transition-colors ${
                  n === currentPage ? 'bg-topo-5 text-white' : 'text-ink-faint hover:bg-base hover:text-ink'
                }`}
              >
                {n}
              </button>
            ))}
            <span className="font-mono text-[9px] text-ink-faint ml-2">Page {currentPage} of {totalPages}</span>
          </div>
        )}
      </div>
    </div>
  );
}
