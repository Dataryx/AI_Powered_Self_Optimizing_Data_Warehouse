import { useState, useEffect } from 'react';
import { ChevronLeft, Radio, Satellite } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileMenuButton from '../MobileMenuButton';
import { formatLocalTime } from '../../utils/time';

export default function MonitoringHeader() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="min-h-14 bg-[#0c0f1a] border-b border-[#1e2540] flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2 sm:py-0 sticky top-0 z-40">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <MobileMenuButton variant="dark" />
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-[#5a6a8a] hover:text-[#c0cde0] transition-colors shrink-0">
          <ChevronLeft size={16} />
          <span className="font-mono text-[11px] tracking-wider">Home</span>
        </button>
        <span className="text-[#2a3555]">/</span>
        <div className="flex items-center gap-2 min-w-0">
          <Satellite size={14} className="text-[#3ecfff] shrink-0" />
          <span className="font-body text-sm font-semibold text-[#c0cde0] truncate">ETL Monitoring</span>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 shrink-0 w-full sm:w-auto justify-end">
        <div className="hidden md:flex items-center gap-4 font-mono text-[11px] text-[#5a6a8a]">
          <span>Time Range: <span className="text-[#c0cde0] font-semibold">Last 24 Hours</span></span>
          <span>Env: <span className="text-[#c0cde0] font-semibold">Production</span></span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0d3a2a] border border-[#1a5c40]">
          <Radio size={10} className="text-[#34d399] animate-pulse" />
          <span className="font-mono text-[9px] text-[#34d399] font-bold tracking-widest uppercase">Live</span>
        </div>
        <span className="font-mono text-xs text-[#5a6a8a] tabular-nums">
          {formatLocalTime(time)}
        </span>
      </div>
    </header>
  );
}
