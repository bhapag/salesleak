import { NextResponse } from "next/server";
import { handleWebhookRequest } from "@/server/ingestion/webhookHandler";

/**
 * Deliberately thin: all auth/rate-limit/parse/ingest logic lives in
 * handleWebhookRequest (src/server/ingestion/webhookHandler.ts). This file's
 * only job is translating between the Next.js Request/Response shape and
 * that function's plain-object result.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string; token: string }> }) {
  const { provider, token } = await params;
  const rawBodyText = await request.text();

  const result = await handleWebhookRequest(provider, token, rawBodyText, request.headers);
  return NextResponse.json(result.body, { status: result.httpStatus });
}

// Webhooks are POST-only — no browsing, no leaking whether a token exists via a GET.
export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
