import { Compass } from 'lucide-react';

export type FooterHealthInfo = {
  status: string;
  uptime: string;
  latency: string;
  healthy: boolean;
  pending?: boolean;
};

type FooterProps = {
  health?: FooterHealthInfo | null;
};

export default function Footer({ health }: FooterProps) {
  return (
    <footer className="border-t border-[#1e2540] bg-[#0c0f1a]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-[#3ecfff30] flex items-center justify-center">
              <Compass size={13} className="text-[#3ecfff50]" />
            </div>
            <div>
              <span className="font-body text-sm font-semibold text-[#5a6a8a]">DataWarehouse Monitor</span>
              <span className="font-mono text-[10px] text-[#3a4a6a] ml-2">v3.2.1</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <span className="font-mono text-[10px] text-[#3a4a6a] tracking-wider">© {new Date().getFullYear()}</span>
            <span className="font-mono text-[10px] text-[#3a4a6a] tracking-wider">All data simulated</span>
          </div>
        </div>

        {health ? (
          <div className="mt-6 pt-6 border-t border-[#1e2540] flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <p className="font-mono text-[9px] text-[#3a4a6a] tracking-[0.2em] uppercase mb-1">Health</p>
              <p
                className={`font-mono text-sm font-semibold ${
                  health.pending ? 'text-[#5a6a8a] animate-pulse' : health.healthy ? 'text-[#34d399]' : 'text-[#f59e0b]'
                }`}
              >
                {health.pending ? 'Loading…' : health.status}
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] text-[#3a4a6a] tracking-[0.2em] uppercase mb-1">Uptime</p>
              <p
                className={`font-mono text-sm font-semibold text-[#a0b0c8] ${
                  health.pending ? 'animate-pulse opacity-70' : ''
                }`}
              >
                {health.pending ? '—' : health.uptime}
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] text-[#3a4a6a] tracking-[0.2em] uppercase mb-1">Latency</p>
              <p
                className={`font-mono text-sm font-semibold text-[#a0b0c8] ${
                  health.pending ? 'animate-pulse opacity-70' : ''
                }`}
              >
                {health.pending ? '—' : health.latency}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
