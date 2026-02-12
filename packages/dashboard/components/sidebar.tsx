'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { BarChart3, Shield, Trophy, Sparkles, LogOut, Hexagon } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/policies', label: 'Policies', icon: Shield },
  { href: '/rankings', label: 'Rankings', icon: Trophy },
  { href: '/recommendations', label: 'Recommendations', icon: Sparkles },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside
      className="w-[240px] h-full flex flex-col border-r relative z-10"
      style={{
        background: 'var(--color-obsidian-surface)',
        borderColor: 'var(--color-obsidian-border)',
      }}
    >
      {/* Logo */}
      <div className="px-6 py-7 border-b" style={{ borderColor: 'var(--color-obsidian-border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--color-neon-indigo), #7c3aed)',
              boxShadow: '0 0 16px rgba(99, 102, 241, 0.3)',
            }}
          >
            <Hexagon size={18} strokeWidth={2.5} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text tracking-tight">Pag0</h1>
            <p className="text-[11px] font-medium tracking-widest uppercase" style={{ color: 'var(--color-txt-muted)' }}>
              Smart Proxy
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5">
        <p
          className="px-3 mb-3 text-[10px] font-semibold tracking-[0.15em] uppercase"
          style={{ color: 'var(--color-txt-muted)' }}
        >
          Navigate
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive ? 'nav-active-indicator' : ''
                  }`}
                  style={{
                    background: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                    color: isActive ? 'var(--color-neon-indigo-light)' : 'var(--color-txt-secondary)',
                  }}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      {session?.user && (
        <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--color-obsidian-border)' }}>
          <div className="flex items-center gap-3 mb-3 px-1">
            {session.user.image ? (
              <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, var(--color-neon-indigo), #7c3aed)' }}
              >
                {session.user.name?.[0] || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-txt-primary)' }}>
                {session.user.name}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--color-txt-muted)' }}>
                {session.user.email}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 hover:opacity-100 opacity-60"
            style={{ color: 'var(--color-txt-secondary)' }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
