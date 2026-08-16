import type { NormalizedLeadInput } from "@/server/ingestion/types";
import { extractEnquiry } from "./enquiryExtraction";

/**
 * Off by default. Architecture prep for future sources that arrive as
 * mostly free text (a semi-structured webhook, and eventually real email
 * ingestion) — set AI_INGESTION_ENRICHMENT=true once such a source actually
 * needs it. Manual entry, CSV, IndiaMART, and the website form already
 * supply their own structured fields directly and never need this.
 */
export function isIngestionEnrichmentEnabled(): boolean {
  return process.env.AI_INGESTION_ENRICHMENT === "true";
}

/**
 * Fills ONLY fields the source left blank, using the same enquiry-extraction
 * feature the manual "paste messy text" UI uses, run against whatever free
 * text the source already provided. A provider-supplied field is never
 * overwritten by an AI guess — this can only add information, never
 * override reliable data, matching the phase's explicit instruction. If
 * extraction fails or is unavailable, the original input passes through
 * unchanged; enrichment is best-effort, never a blocking step.
 */
export async function enrichIngestionInputWithAi(companyId: string, input: NormalizedLeadInput): Promise<NormalizedLeadInput> {
  if (!isIngestionEnrichmentEnabled()) return input;

  const freeText = input.requirement?.trim();
  if (!freeText) return input;

  const missingStructuredFields = !input.product || !input.quantity || !input.phone;
  if (!missingStructuredFields) return input;

  const result = await extractEnquiry(companyId, { text: freeText });
  if (!result.ok) return input;

  return {
    ...input,
    companyName: input.companyName || result.data.companyName,
    product: input.product || result.data.product,
    quantity: input.quantity || result.data.quantity,
    city: input.city || result.data.location,
    phone: input.phone || result.data.phone,
    email: input.email || result.data.email,
  };
}
