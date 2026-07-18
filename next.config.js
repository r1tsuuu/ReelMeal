const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Next's automatic file tracer doesn't statically detect the yt-dlp/ffmpeg
    // binary paths (they're resolved dynamically at runtime inside those
    // packages), so without this the deployed function is missing them entirely.
    // (This option is under `experimental` in Next 14 — it only moved to
    // top-level config in Next 15.)
    outputFileTracingIncludes: {
      '/api/extract': [
        './node_modules/youtube-dl-exec/bin/**/*',
        './node_modules/ffmpeg-static/**/*',
      ],
    },
    // Both packages resolve their binary path relative to their own __dirname
    // at runtime. Webpack-bundling them (Next's default for route handlers)
    // rewrites that resolution and breaks it silently — this keeps them as
    // plain runtime `require()`s from node_modules instead.
    serverComponentsExternalPackages: ['youtube-dl-exec', 'ffmpeg-static'],
  },
};

module.exports = withPWA(nextConfig);
