/**
 * Server-side base URL resolution. Not currently required by anything in
 * the app — the webhook/website-form URL displayed on /settings/integrations
 * (src/components/integrations/IntegrationCard.tsx) already derives from
 * `window.location.origin` client-side, which is correct in any environment
 * with zero configuration. This exists for future server-rendered links
 * (emails, metadata, absolute URLs generated outside a browser context)
 * so they don't have to reinvent this fallback chain.
 */
export function getAppBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
