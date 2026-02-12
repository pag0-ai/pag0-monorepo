import type { NextConfig } from 'next';

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const nextConfig: NextConfig = {
  // Proxy API requests to backend
  // Exclude /api/auth/* (handled by NextAuth) and /api/onboarding/* (Next.js API routes)
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
      },
      {
        source: '/api/onboarding/:path*',
        destination: '/api/onboarding/:path*',
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
