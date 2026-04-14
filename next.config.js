/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: "standalone",
    devIndicators: false,

    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'image.tmdb.org' },
            { protocol: 'https', hostname: 'artworks.thetvdb.com' },
        ],
    },

    webpack(config) {
        config.module.rules.push({
            test: /\.svg$/,
            use: ["@svgr/webpack"],
        });

        return config;
    },

    experimental: {
        scrollRestoration: true,
        largePageDataBytes: 256 * 1000,
    },

    env: {
        COMMIT_TAG: process.env.COMMIT_TAG || "local",
    },
};

module.exports = nextConfig;
