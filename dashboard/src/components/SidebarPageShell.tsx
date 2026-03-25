import { useSidebarStore } from '../store/sidebarStore';
import Sidebar from './Sidebar';

type SidebarPageShellProps = {
  children: React.ReactNode;
  /** Outer wrapper (e.g. monitoring dark bg). */
  className?: string;
};

/**
 * Shared layout: sidebar + responsive main column (full width on phone, offset on lg+).
 * Matches homepage flow: comfortable horizontal padding on small screens.
 */
export default function SidebarPageShell({ children, className = '' }: SidebarPageShellProps) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const closeMobile = useSidebarStore((s) => s.closeMobile);

  return (
    <div className={`min-h-screen flex ${className}`.trim()}>
      <Sidebar />
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] lg:hidden"
          aria-label="Close navigation"
          onClick={closeMobile}
        />
      )}
      <div
        className={`flex-1 min-w-0 min-h-screen flex flex-col transition-[margin] duration-200 ease-out ${
          collapsed ? 'lg:ml-16' : 'lg:ml-60'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
