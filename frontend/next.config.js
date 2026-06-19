/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Quantum speed: production optimizations
  swcMinify: true,
  compress: true,
  poweredByHeader: false,

  // Optimized images for external assets + lazy + fast CDN
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: 'cloudflare-ipfs.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days cache
    deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Bundle optimization: safe optimizePackageImports (no barrel breaking)
  experimental: {
    optimizePackageImports: [
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-react-ui',
      'axios',
    ],
  },

  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      buffer: require.resolve("buffer"),
    };

    // Keep default chunking for stability + speed (avoid custom solana split that breaks)
    return config;
  },
};

module.exports = nextConfig;
