import { useState, useEffect } from 'react';
import { ChevronLeft, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatLocalTime } from '../../utils/time';

export default function StorageHeader() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="h-14 border-b border-contour-strong bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-ink-muted hover:text-ink transition-colors">
          <ChevronLeft size={16} />
          <span className="font-mono text-[11px] tracking-wider">Home</span>
        </button>
        <span className="text-ink-faint">/</span>
        <span className="font-body text-sm font-semibold text-ink">Storage & Resources</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-topo-4/10 border border-topo-4/20">
          <Radio size={10} className="text-topo-4 animate-pulse" />
          <span className="font-mono text-[9px] text-topo-4 font-bold tracking-widest uppercase">Live</span>
        </div>
        <span className="font-mono text-xs text-ink-soft tabular-nums">
          {formatLocalTime(time)}
        </span>
      </div>
    </header>
  );
}
