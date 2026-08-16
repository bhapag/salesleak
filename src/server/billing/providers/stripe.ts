import crypto from "crypto";
import type { BillingProvider, CheckoutSessionParams, CheckoutSessionResult, PortalSessionParams, PortalSessionResult, WebhookVerifyResult, StripeEventLike } from "../types";

const API_BASE = "https://api.stripe.com/v1";
const SIGNATURE_TOLERANCE_SECONDS = 300;

function priceIdForPlan(plan: "STARTER" | "GROWTH"): string | undefined {
  return plan === "STARTER" ? process.env.STRIPE_PRICE_STARTER : process.env.STRIPE_PRICE_GROWTH;
}

function formEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

/**
 * Talks to Stripe's REST API directly over fetch — no SDK dependency, same
 * minimal-dependency pattern as AnthropicProvider (src/server/ai). Reads
 * STRIPE_SECRET_KEY (server-only, never sent to the client) plus per-plan
 * Stripe Price ids (STRIPE_PRICE_STARTER/STRIPE_PRICE_GROWTH — account-
 * specific ids created in the Stripe Dashboard, not something that can be
 * hardcoded or guessed). Every request shape below — Checkout Session
 * parameters, the Billing Portal session endpoint, and the manual webhook
 * signature algorithm — was checked directly against Stripe's own published
 * API reference during Phase 14 research, not guessed.
 */
export class StripeProvider implements BillingProvider {
  readonly name = "stripe";

  isConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY;
  }

  private secretKey(): string {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
    return key;
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    if (!this.isConfigured()) return { ok: false, error: "Billing isn't connected in this environment yet." };
    const priceId = priceIdForPlan(params.plan);
    if (!priceId) return { ok: false, error: `No Stripe price is configured for the ${params.plan} plan yet.` };

    const body: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.companyId,
      "metadata[companyId]": params.companyId,
      "metadata[plan]": params.plan,
    };
    if (params.existingStripeCustomerId) body.customer = params.existingStripeCustomerId;
    else body.customer_email = params.customerEmail;

    try {
      const res = await fetch(`${API_BASE}/checkout/sessions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.secretKey()}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: formEncode(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, error: `Stripe checkout session error ${res.status}: ${text.slice(0, 300)}` };
      }
      const json = (await res.json()) as { url?: string };
      if (!json.url) return { ok: false, error: "Stripe did not return a checkout URL." };
      return { ok: true, url: json.url };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not reach Stripe." };
    }
  }

  async createPortalSession(params: PortalSessionParams): Promise<PortalSessionResult> {
    if (!this.isConfigured()) return { ok: false, error: "Billing isn't connected in this environment yet." };
    try {
      const res = await fetch(`${API_BASE}/billing_portal/sessions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.secretKey()}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: formEncode({ customer: params.stripeCustomerId, return_url: params.returnUrl }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, error: `Stripe portal session error ${res.status}: ${text.slice(0, 300)}` };
      }
      const json = (await res.json()) as { url?: string };
      if (!json.url) return { ok: false, error: "Stripe did not return a portal URL." };
      return { ok: true, url: json.url };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not reach Stripe." };
    }
  }

  /**
   * Manual HMAC-SHA256 verification per Stripe's documented algorithm (no
   * SDK): split the Stripe-Signature header into its timestamp (t=) and v1
   * signature(s), reject if the timestamp is outside a 5-minute tolerance
   * (replay protection), recompute HMAC-SHA256 of "{timestamp}.{rawBody}"
   * using the endpoint secret, and compare with a constant-time comparison
   * (crypto.timingSafeEqual) against each v1 value — never a plain `===`,
   * which would leak timing information about how much of the signature
   * matched.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): WebhookVerifyResult {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return { ok: false, error: "STRIPE_WEBHOOK_SECRET is not configured." };
    if (!signatureHeader) return { ok: false, error: "Missing Stripe-Signature header." };

    const parts = signatureHeader.split(",").map((p) => p.trim().split("="));
    const timestamp = parts.find(([k]) => k === "t")?.[1];
    const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
    if (!timestamp || signatures.length === 0) return { ok: false, error: "Malformed Stripe-Signature header." };

    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > SIGNATURE_TOLERANCE_SECONDS) {
      return { ok: false, error: "Stripe webhook timestamp outside tolerance (possible replay)." };
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");

    const matches = signatures.some((sig) => {
      const sigBuf = Buffer.from(sig, "hex");
      return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
    });
    if (!matches) return { ok: false, error: "Stripe webhook signature verification failed." };

    try {
      const event = JSON.parse(rawBody) as StripeEventLike;
      return { ok: true, event };
    } catch {
      return { ok: false, error: "Stripe webhook payload was not valid JSON." };
    }
  }
}

export const stripeProvider = new StripeProvider();
