import type { ProviderAdapter } from "./types";
import { indiaMartAdapter } from "./indiamart";
import { websiteFormAdapter } from "./website";

/**
 * Webhook-routable adapters, keyed by the URL slug used in
 * /api/webhooks/[provider]/[token]. Deliberately does NOT include the email
 * adapter (src/server/ingestion/connectors/email.ts) — there is no live
 * inbound-email route this phase, and a "webhook" that doesn't actually
 * receive anything shouldn't be reachable.
 */
export const WEBHOOK_ADAPTERS: Record<string, ProviderAdapter> = {
  [indiaMartAdapter.slug]: indiaMartAdapter,
  [websiteFormAdapter.slug]: websiteFormAdapter,
};

export function getAdapterBySlug(slug: string): ProviderAdapter | null {
  return WEBHOOK_ADAPTERS[slug] ?? null;
}

export function getAdapterByType(type: string): ProviderAdapter | null {
  return Object.values(WEBHOOK_ADAPTERS).find((a) => a.type === type) ?? null;
}
