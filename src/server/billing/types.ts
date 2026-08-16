export type CheckoutSessionParams = {
  companyId: string;
  /** FOUNDING is never self-serve checkout — assigned directly, see billing actions. */
  plan: "STARTER" | "GROWTH";
  customerEmail: string;
  existingStripeCustomerId: string | null;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSessionResult = { ok: true; url: string } | { ok: false; error: string };

export type PortalSessionParams = {
  stripeCustomerId: string;
  returnUrl: string;
};

export type PortalSessionResult = { ok: true; url: string } | { ok: false; error: string };

/** Minimal shape this app reads from a Stripe Event — not the full Stripe type, just what the webhook handler actually uses. */
export type StripeEventLike = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export type WebhookVerifyResult = { ok: true; event: StripeEventLike } | { ok: false; error: string };

/**
 * Provider abstraction for billing (Phase 14) — mirrors src/server/ai's
 * AIProvider shape and reasoning: every caller goes through this interface,
 * never a provider by name, so a second provider or a config-based switch
 * later touches one function (getActiveBillingProvider), not feature code.
 */
export interface BillingProvider {
  readonly name: string;
  isConfigured(): boolean;
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;
  createPortalSession(params: PortalSessionParams): Promise<PortalSessionResult>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): WebhookVerifyResult;
}
