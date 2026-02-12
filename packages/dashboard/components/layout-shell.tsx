'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sidebar } from './sidebar';

const NO_SIDEBAR_PATHS = ['/onboarding', '/login', '/register'];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR_PATHS.some(p => pathname.startsWith(p));
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--color-obsidian-base)' }}>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(7,7,14,0.75)' }}
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 h-full w-[240px]">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto p-4 md:p-8 relative z-10">
        {/* Mobile header */}
        <div className="flex items-center gap-3 mb-4 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl"
            style={{ background: 'var(--color-obsidian-surface)', border: '1px solid var(--color-obsidian-border)' }}
          >
            <Menu size={20} style={{ color: 'var(--color-txt-secondary)' }} />
          </button>
          <span className="text-lg font-bold gradient-text">Pag0</span>
        </div>
        {children}
      </main>
    </div>
  );
}
