import type { NextConfig } from 'next';

/**
 * Next.js 16: workspace packages (@shiftcrack/shared) are transpiled
 * automatically and linting is handled by a dedicated ESLint job in CI, so
 * no extra config is required here.
 *
 * Security headers: a pragmatic (non-nonce) CSP is used because the app
 * relies on inline bootstrap/Next scripts and inline style attributes; a
 * nonce-based policy would force every page into dynamic rendering. The
 * policy still locks down script/connect/style origins, framing and objects.
 * `next/font` self-hosts the Lora font, so font-src only needs 'self'.
 * connect-src is derived from NEXT_PUBLIC_API_URL so the browser can reach
 * the API in both dev and prod.
 */
const isProd = process.env.NODE_ENV === 'production';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
let apiOrigin = '';
try {
  apiOrigin = new URL(apiBase).origin;
} catch {
  // Relative API base (same origin) — connect-src 'self' already covers it.
  apiOrigin = '';
}

// WebSocket HMR only exists in `next dev`; production talks HTTPS to the API.
const connectSrc = ["'self'", apiOrigin, ...(isProd ? [] : ['ws:', 'wss:'])]
  .filter(Boolean)
  .join(' ');

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd && (apiOrigin === '' || apiOrigin.startsWith('https:'))
    ? ['upgrade-insecure-requests']
    : []),
];

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspDirectives.join('; ') },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  ...(isProd
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
