import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const isDev = process.env.NODE_ENV !== 'production';

// Content-Security-Policy. 'unsafe-inline' is required for Next.js inline runtime/styles
// (no nonce pipeline); dev additionally needs 'unsafe-eval' and ws: for HMR. The only
// external subresource is the Google "G" icon on the login page (gstatic).
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://www.gstatic.com",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws:' : ''}`,
].join('; ');

// Long-lived immutable caching for static media served from `public/` (logos,
// favicons, fonts). Matched by file extension so HTML and API responses are never
// affected. Next.js already sends immutable Cache-Control for its own
// content-hashed `_next/static` bundles, so this only covers the un-hashed
// `public/` assets. They change rarely and only via a redeploy; if one must change
// immediately, ship it under a new filename.
const immutableAssetCacheControl = 'public, max-age=31536000, immutable';

// Wraps the config with @next/bundle-analyzer. It is a no-op unless ANALYZE=true,
// so normal `next build` / `next dev` are unaffected. Run `npm run analyze` to
// generate the interactive treemap reports under `.next/analyze/`.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['pino'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
      {
        // Un-hashed static media in `public/`. Extension-scoped so it cannot match
        // HTML routes or `/api/*`. Merges with (does not replace) the security
        // headers above.
        source: '/:path*(svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf)',
        headers: [{ key: 'Cache-Control', value: immutableAssetCacheControl }],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
