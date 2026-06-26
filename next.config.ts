import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // removed better-sqlite3 from serverExternalPackages
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
