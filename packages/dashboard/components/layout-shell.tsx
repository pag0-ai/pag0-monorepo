'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';

const NO_SIDEBAR_PATHS = ['/onboarding', '/login', '/register'];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR_PATHS.some(p => pathname.startsWith(p));

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--color-obsidian-base)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto p-8 relative z-10">
        {children}
      </main>
    </div>
  );
}
