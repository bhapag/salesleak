import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// No nonces — that requires every page to be dynamically rendered, which
// isn't worth the tradeoff here (see Next's CSP guide). 'unsafe-inline' for
// script/style is the documented fallback and matches what Next itself
// injects for hydration; nothing in this app needs a third-party script or
// style origin.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'self';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Every route except the public, deliberately-embeddable website-form
        // page (see src/app/website-form/[token]/page.tsx) — that page is
        // meant to be iframed into a company's own external site, so it must
        // not inherit frame-ancestors/CSP restrictions meant for the
        // authenticated app and auth pages.
        source: "/((?!website-form).*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // Safe everywhere, including the embeddable form page.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
