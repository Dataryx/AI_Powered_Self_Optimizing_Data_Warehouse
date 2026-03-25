import { useSidebarStore } from '../store/sidebarStore';
import Sidebar from './Sidebar';

/** @deprecated Prefer SidebarPageShell for responsive mobile drawer + margins. */
export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0d18' }}>
      <Sidebar />
      <div
        className={`flex-1 min-h-screen flex flex-col min-w-0 transition-[margin] duration-200 ease-out ${
          collapsed ? 'lg:ml-16' : 'lg:ml-60'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
