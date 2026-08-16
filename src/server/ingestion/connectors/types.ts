import type { IntegrationType } from "@/generated/prisma/client";
import type { NormalizedLeadInput } from "../types";

/**
 * What every provider adapter must implement. A route handler or the test
 * console only ever talks to this interface — provider-specific field
 * mapping and quirks live entirely inside the adapter, never in the handler.
 */
export type ParseResult = { ok: true; input: NormalizedLeadInput } | { ok: false; error: string };

export interface ProviderAdapter {
  /** The IntegrationType this adapter serves — used to look up config/secrets. */
  type: IntegrationType;
  /** URL slug used in /api/webhooks/[provider]/[token] (lowercase, stable — never rename once live). */
  slug: string;
  /** Maps a provider's raw payload into the universal normalized shape. Never throws — returns a ParseResult. */
  parse(rawPayload: unknown): ParseResult;
  /** A realistic sample payload for the "Send Test Payload" console — exercises the real parse() path. */
  samplePayload(): unknown;
}
