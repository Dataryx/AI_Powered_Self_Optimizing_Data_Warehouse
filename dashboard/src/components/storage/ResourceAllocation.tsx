import { RefreshCw, Server } from 'lucide-react';

interface ResourceAllocationProps { data?: any; loading?: boolean }

export default function ResourceAllocation({ data, loading }: ResourceAllocationProps) {
  const res = data?.resources;
  const connections = res?.connections ?? {};
  const total = Number(connections.total) ?? 0;
  const active = Number(connections.active) ?? 0;
  const idle = Number(connections.idle) ?? 0;
  const dbSize = res?.database_size ?? '—';
  const utilizationPct = total > 0 ? Math.round((active / total) * 100) : 0;
  return (
    <div className="bg-surface rounded-2xl border border-contour-strong overflow-hidden h-full">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-topo-5/10 flex items-center justify-center">
            <Server size={16} className="text-topo-5" />
          </div>
          <div>
            <h3 className="font-body text-base font-bold text-ink">Resource Allocation</h3>
            <p className="font-mono text-[10px] text-ink-faint tracking-wider">Updated: 6:52:23 PM</p>
          </div>
        </div>
        <button className="w-7 h-7 rounded-lg bg-base border border-contour flex items-center justify-center text-ink-muted hover:text-ink transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="px-5 pb-5">
        {loading && !res && <p className="font-mono text-[10px] text-ink-faint py-4">Loading resources…</p>}
        {!loading && !res && <p className="font-mono text-[10px] text-ink-faint py-4">No resource data. Ensure storage API is running.</p>}
        {res && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-base/50 rounded-xl p-3 border border-contour">
            <span className="font-mono text-[9px] text-ink-faint tracking-widest uppercase block mb-1">Connections</span>
            <span className="font-body text-2xl font-bold text-ink">{total}</span>
            <div className="flex gap-3 mt-1">
              <span className="font-mono text-[9px] text-ink-faint">Active: <span className="text-ink">{active}</span></span>
              <span className="font-mono text-[9px] text-ink-faint">Idle: <span className="text-ink">{idle}</span></span>
            </div>
          </div>
          <div className="bg-base/50 rounded-xl p-3 border border-contour">
            <span className="font-mono text-[9px] text-ink-faint tracking-widest uppercase block mb-1">Utilization</span>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-topo-4" />
              <span className="font-body text-2xl font-bold text-ink">{utilizationPct}%</span>
            </div>
          </div>
          <div className="bg-base/50 rounded-xl p-3 border border-contour">
            <span className="font-mono text-[9px] text-ink-faint tracking-widest uppercase block mb-1">Database Size</span>
            <div className="h-2 bg-base rounded-full overflow-hidden mt-2 mb-1">
              <div className="h-full bg-topo-6 rounded-full" style={{ width: `${Math.min(100, utilizationPct)}%`, opacity: 0.7 }} />
            </div>
            <span className="font-body text-lg font-bold text-topo-4">{dbSize}</span>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
