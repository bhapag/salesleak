import { headers } from "next/headers";

/** Best-effort client IP for rate-limit keys — trusts x-forwarded-for, which Vercel sets on every request. Never used for anything security-critical beyond rate limiting (spoofable in a self-hosted setup without a trusted proxy in front). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * In-memory sliding-window rate limiter, keyed by caller-supplied string.
 * Shared by webhook ingestion (src/server/ingestion/security.ts) and auth
 * abuse protection (src/server/actions/auth.ts) — the same simple mechanism
 * fits both without introducing paid infrastructure.
 *
 * This is adequate for a single warm server instance; it resets on cold
 * start and doesn't share state across concurrent instances. A real
 * high-traffic deployment behind multiple instances would need a shared
 * store (Redis) instead — noted here and in ARCHITECTURE.md as the one
 * piece of this that doesn't survive scaling out. Acceptable for a pilot
 * deployment's traffic level.
 */
const requestLog = new Map<string, number[]>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
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
