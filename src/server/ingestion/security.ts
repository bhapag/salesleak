import { randomBytes, createHmac, timingSafeEqual } from "crypto";

/** The secret path segment identifying a company's webhook — long and random enough that guessing is infeasible. */
export function generateWebhookToken(): string {
  return randomBytes(24).toString("hex");
}

/** Optional HMAC signing secret, shown to the user once at generation time and masked thereafter. */
export function generateSigningSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Verifies a `sha256=<hex>` (or bare hex) signature header against the raw
 * request body. Only meaningful for providers that actually sign their
 * webhook requests — callers should skip this entirely when no signingSecret
 * is configured for the integration, rather than treating "no signature" as
 * a failure (most providers, and this phase's own connectors, don't sign).
 */
export function verifyHmacSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const provided = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const providedBuf = Buffer.from(provided, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

/** Rejects requests whose provider-supplied timestamp is too far from "now" — basic replay protection. */
export function isTimestampFresh(timestampMs: number, maxSkewMs = 5 * 60 * 1000): boolean {
  return Math.abs(Date.now() - timestampMs) <= maxSkewMs;
}

/**
 * In-memory sliding-window rate limiter, keyed by webhook token. Adequate
 * for a single-process local dev server; a real deployment behind multiple
 * instances would need a shared store (Redis) instead — noted in
 * ARCHITECTURE.md as the one piece of this that doesn't survive scaling out.
 */
const requestLog = new Map<string, number[]>();

export function checkRateLimit(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    requestLog.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return true;
}
