import type { NextConfig } from "next";

function safeOrigin(value?: string) {
  if (!value) return "";
  try { const url = new URL(value); return url.protocol === "https:" ? url.origin : ""; } catch { return ""; }
}

const analyticsOrigin = safeOrigin(process.env.NEXT_PUBLIC_UMAMI_SRC);
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"} https://integrationjs.tbank.ru${analyticsOrigin ? ` ${analyticsOrigin}` : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://securepay.tinkoff.ru${analyticsOrigin ? ` ${analyticsOrigin}` : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "script-src-attr 'none'",
  "base-uri 'self'",
  "form-action 'self' https://securepay.tinkoff.ru",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/admin/sw.js', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      { source: '/admin-manifest.webmanifest', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(self)" },
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
    ];
  },
};

export default nextConfig;
