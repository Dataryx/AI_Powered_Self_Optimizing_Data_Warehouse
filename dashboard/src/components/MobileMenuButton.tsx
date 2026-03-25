import { Menu } from 'lucide-react';
import { useSidebarStore } from '../store/sidebarStore';

const variants = {
  default:
    'border-contour-strong bg-surface/90 text-ink-muted hover:text-ink hover:bg-surface-alt',
  dark: 'border-[#1e2540] bg-[#0c0f1a] text-[#a0b0cc] hover:text-[#e0e8f5] hover:bg-[#151a2a]',
};

type Props = { variant?: keyof typeof variants };

/** Opens the sidebar drawer on small screens (hidden at lg+). */
export default function MobileMenuButton({ variant = 'default' }: Props) {
  const openMobile = useSidebarStore((s) => s.openMobile);

  return (
    <button
      type="button"
      className={`lg:hidden shrink-0 p-2 -ml-0.5 rounded-xl border transition-colors ${variants[variant]}`}
      aria-label="Open navigation menu"
      onClick={openMobile}
    >
      <Menu size={18} strokeWidth={2} />
    </button>
  );
}
