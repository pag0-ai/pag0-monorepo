import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Sidebar } from '@/components/sidebar';

export const metadata: Metadata = {
  title: 'Pag0 Dashboard',
  description: 'Smart Proxy Layer for x402 - Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">
        <Providers>
          <div className="flex h-screen bg-gray-950">
            <Sidebar />
            <main className="flex-1 overflow-auto p-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
