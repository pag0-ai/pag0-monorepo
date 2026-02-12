import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { LayoutShell } from '@/components/layout-shell';

export const metadata: Metadata = {
  title: 'Pag0 Dashboard',
  description: 'Smart Proxy Layer for x402 - Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">
        <Providers>
          <LayoutShell>{children}</LayoutShell>
        </Providers>
      </body>
    </html>
  );
}
