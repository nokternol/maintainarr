// Next's pages-router file-system router treats every file under `src/pages/`
// matching `pageExtensions` as a route, with no built-in exclusion for colocated
// `__tests__`/`.stories.tsx` files — a negative lookbehind keeps `welcome.tsx` a
// route while `welcome.test.tsx`/`welcome.stories.tsx` are ignored, with no
// renaming of real page files needed (verified: without this, `next build` pulls
// `automations.page.test.tsx` in as a route, which drags its `msw` test-mock
// import into the production webpack bundle and fails to compile).
const excludeNonPageFiles = (pageExtensions) =>
  pageExtensions.map((ext) => `(?<!\\.(?:test|stories)\\.)${ext}`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  pageExtensions: excludeNonPageFiles(['tsx', 'ts', 'jsx', 'js']),

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'artworks.thetvdb.com' },
    ],
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
