/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  images: {
    domains: ['image.tmdb.org'],
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },

  experimental: {
    scrollRestoration: true,
    largePageDataBytes: 256 * 1000,
  },

  env: {
    COMMIT_TAG: process.env.COMMIT_TAG || 'local',
  },
};

module.exports = nextConfig;
