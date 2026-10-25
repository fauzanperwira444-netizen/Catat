import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Catat berjalan lokal, tanpa telemetri dan tanpa gambar dari luar.
  poweredByHeader: false,
  devIndicators: false,
  images: { unoptimized: true },
};

export default nextConfig;
