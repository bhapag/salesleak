import { stripeProvider } from "./providers/stripe";
import type { BillingProvider } from "./types";

/**
 * The one place a billing provider is chosen — mirrors src/server/ai/client.ts's
 * getActiveProvider(). Returns null when unconfigured (no STRIPE_SECRET_KEY),
 * which every caller treats as "billing not connected in this environment"
 * rather than attempting a call that would fail — the same honest-mock-mode
 * discipline as the AI layer, never a fake checkout or a pretend payment.
 */
export function getActiveBillingProvider(): BillingProvider | null {
  return stripeProvider.isConfigured() ? stripeProvider : null;
}

export function isBillingConfigured(): boolean {
  return stripeProvider.isConfigured();
}
