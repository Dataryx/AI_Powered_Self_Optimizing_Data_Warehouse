import { Compass } from 'lucide-react';

export default function Footer() {
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
              <span className="font-mono text-[10px] text-[#3a4a6a] ml-2">v1.0</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <span className="font-mono text-[10px] text-[#3a4a6a] tracking-wider">© {new Date().getFullYear()}</span>
            <span className="font-mono text-[10px] text-[#3a4a6a] tracking-wider">Live warehouse data</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
