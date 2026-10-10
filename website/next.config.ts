import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Static export: the build is plain HTML/CSS/JS in `out/`, so there is no
  // server, API route or runtime secret to attack. Host it on any static host.
  output: 'export',
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  // The app's own lockfile sits one level up; keep this project self-contained
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
