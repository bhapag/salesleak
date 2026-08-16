import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/server/billing/webhookHandler";

/**
 * Deliberately thin, same discipline as the lead-ingestion webhook route
 * (src/app/api/webhooks/[provider]/[token]/route.ts) — all signature
 * verification and processing logic lives in handleStripeWebhook. Reads the
 * raw body as text (never JSON-parses it first) because Stripe's signature
 * verification is computed over the exact raw bytes; parsing and
 * re-stringifying would change the payload and always fail verification.
 */
export async function POST(request: Request) {
  const rawBodyText = await request.text();
  const signature = request.headers.get("stripe-signature");

  const result = await handleStripeWebhook(rawBodyText, signature);
  return NextResponse.json(result.body, { status: result.httpStatus });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
