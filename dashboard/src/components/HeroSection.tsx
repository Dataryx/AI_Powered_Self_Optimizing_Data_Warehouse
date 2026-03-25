import { motion } from 'framer-motion';
import { Map, Layers, Activity } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 pt-10 pb-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f8717110] border border-[#f8717125]">
              <Map size={11} className="text-[#f87171]" />
              <span className="font-mono text-[9px] text-[#f87171] font-bold tracking-widest uppercase">Overview</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#3ecfff10] border border-[#3ecfff25]">
              <Layers size={11} className="text-[#3ecfff]" />
              <span className="font-mono text-[9px] text-[#3ecfff] font-bold tracking-widest uppercase">3 Layers</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#34d39910] border border-[#34d39925]">
              <Activity size={11} className="text-[#34d399]" />
              <span className="font-mono text-[9px] text-[#34d399] font-bold tracking-widest uppercase">Online</span>
            </div>
          </div>
          <h1 className="font-body text-4xl md:text-5xl lg:text-6xl font-900 text-[#e0e8f5] tracking-tight leading-[1.05]">
            Data Warehouse<br /><span className="text-[#3ecfff]">Dashboard</span>
          </h1>
        </motion.div>
      </div>
      <div className="mt-8 relative h-8">
        <svg className="w-full h-full" viewBox="0 0 1200 32" preserveAspectRatio="none">
          <path d="M0,16 Q150,4 300,16 T600,16 T900,16 T1200,16" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <path d="M0,20 Q200,8 400,20 T800,20 T1200,20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        </svg>
      </div>
    </section>
  );
}
