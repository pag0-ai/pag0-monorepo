import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Proxy API requests to backend during development
  // Exclude /api/auth/* (handled by NextAuth)
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*', // Keep NextAuth routes local
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
