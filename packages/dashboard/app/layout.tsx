import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { LayoutShell } from '@/components/layout-shell';

export const metadata: Metadata = {
  title: 'Pag0 — Smart Proxy Dashboard',
  description: 'x402 Spend Firewall + API Curation + Smart Cache',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="noise-overlay scanlines">
        <Providers>
          <LayoutShell>{children}</LayoutShell>
        </Providers>
      </body>
    </html>
  );
}
