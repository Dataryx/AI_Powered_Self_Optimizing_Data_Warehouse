import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  LayoutDashboard,
  Activity,
  Table2,
  Lightbulb,
  BarChart3,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useSidebarStore } from '../store/sidebarStore';
import { useMediaQuery } from '../hooks/useMediaQuery';

const sections = [
  { label: 'OVERVIEW', items: [{ id: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'DATA & OPS',
    items: [
      { id: '/monitoring', label: 'Monitoring', icon: Activity },
      { id: '/data-explorer', label: 'Data Explorer', icon: Table2 },
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      { id: '/optimizations', label: 'Optimizations', icon: Lightbulb },
      { id: '/analytics', label: 'Analytics', icon: BarChart3 },
      { id: '/alerts', label: 'Alerts', icon: Bell },
    ],
  },
  { label: 'SYSTEM', items: [{ id: '/settings', label: 'Settings', icon: Settings }] },
];

export default function Sidebar() {
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebarStore();
  const isLg = useMediaQuery('(min-width: 1024px)');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLg) closeMobile();
  }, [isLg, closeMobile]);

  const showText = !collapsed || !isLg;

  const go = (path: string) => {
    navigate(path);
    closeMobile();
  };

  return (
    <motion.aside
      initial={false}
      animate={
        isLg
          ? { width: collapsed ? 64 : 240, x: 0 }
          : { width: 280, x: mobileOpen ? 0 : -300 }
      }
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="fixed left-0 top-0 h-screen bg-[#0c0f1a] border-r border-[#1e2540] z-50 flex flex-col overflow-hidden shadow-xl lg:shadow-none max-lg:max-w-[min(280px,88vw)]"
    >
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-[#1e2540] flex-shrink-0">
        <div className="w-8 h-8 rounded-full border-2 border-[#3ecfff] flex items-center justify-center flex-shrink-0">
          <Compass size={15} className="text-[#3ecfff]" />
        </div>
        <AnimatePresence>
          {showText && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col min-w-0 flex-1"
            >
              <span className="font-body text-sm font-bold text-[#e0e8f5] tracking-tight">DW</span>
              <span className="font-mono text-[8px] text-[#3a4a6a] tracking-[0.2em] uppercase">Monitor</span>
            </motion.div>
          )}
        </AnimatePresence>
        {!isLg && (
          <button
            type="button"
            onClick={closeMobile}
            className="ml-auto p-2 rounded-lg text-[#5a6a8a] hover:text-[#e0e8f5] hover:bg-[#ffffff08] transition-colors lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 overscroll-contain">
        {sections.map((section) => (
          <div key={section.label} className="mb-4">
            <AnimatePresence>
              {showText && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-[8px] tracking-[0.25em] text-[#3a4a6a] uppercase px-2.5 mb-1.5"
                >
                  {section.label}
                </motion.p>
              )}
            </AnimatePresence>
            {section.items.map((item) => {
              const isActive = location.pathname === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  title={collapsed && isLg ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl mb-0.5 transition-all duration-200 relative group ${
                    isActive ? 'bg-[#3ecfff10] text-[#3ecfff]' : 'text-[#5a6a8a] hover:text-[#c0cde0] hover:bg-[#ffffff06]'
                  } ${collapsed && isLg ? 'justify-center' : ''}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebarActive"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[#3ecfff]"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon size={16} className="flex-shrink-0" />
                  <AnimatePresence>
                    {showText && (
                      <motion.span
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.15 }}
                        className="font-body text-[13px] font-medium whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-[#1e2540] p-2 flex-shrink-0 hidden lg:block">
        <button
          type="button"
          onClick={toggle}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[#4a5a7a] hover:text-[#c0cde0] hover:bg-[#ffffff06] transition-all"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-mono text-[10px] tracking-wider"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
