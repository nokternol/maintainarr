// Next's pages-router file-system router treats every file under `src/pages/`
// matching `pageExtensions` as a route. Real routes are named `*.page.tsx`
// (explicit inclusion) rather than excluding `.test.tsx`/`.stories.tsx` via a
// negative-lookbehind regex — Next's dev server resolves `_app`/`_document`
// through a different code path than its build-time file scanner, and that
// path treats each pageExtensions entry as a literal filename suffix, not a
// regex (see vercel/next.js#33669, vercel/next.js#32552; open since Next 12,
// unfixed as of 15.5.12). A lookbehind there silently breaks dev's resolution
// of custom _app/_document, with no error. Explicit `.page.` extensions are
// plain strings, so the same pageExtensions value works identically in dev
// and build, and colocated test/story files are simply never matched.
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  pageExtensions: ['page.tsx', 'page.ts', 'page.jsx', 'page.js'],

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
