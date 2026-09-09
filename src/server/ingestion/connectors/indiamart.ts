import type { ProviderAdapter, ParseResult } from "./types";

/**
 * The lead object IndiaMART's Lead Manager Push API delivers. Field names are
 * from IndiaMART's own published Push API documentation (help.indiamart.com —
 * "Integration of IndiaMART's Lead Manager CRM Push API with Third Party CRMs
 * – Real-time Push of Leads").
 *
 * QUERY_QUANTITY is not in that document's field list but does appear in some
 * IndiaMART payloads, so it stays as a best-effort optional read.
 */
export type IndiaMartLead = {
  UNIQUE_QUERY_ID?: string;
  QUERY_TYPE?: string;
  QUERY_TIME?: string;
  SENDER_NAME?: string;
  SENDER_COMPANY?: string;
  SENDER_MOBILE?: string;
  SENDER_MOBILE_ALT?: string;
  SENDER_PHONE?: string;
  SENDER_PHONE_ALT?: string;
  SENDER_EMAIL?: string;
  SENDER_EMAIL_ALT?: string;
  SENDER_ADDRESS?: string;
  SENDER_CITY?: string;
  SENDER_STATE?: string;
  SENDER_PINCODE?: string;
  SENDER_COUNTRY_ISO?: string;
  SUBJECT?: string;
  QUERY_PRODUCT_NAME?: string;
  QUERY_MCAT_NAME?: string;
  QUERY_MESSAGE?: string;
  QUERY_QUANTITY?: string;
};

/**
 * What actually arrives on the wire: IndiaMART wraps the lead in a
 * CODE/STATUS/RESPONSE envelope rather than posting the lead fields at the
 * top level —
 *   { "CODE": 200, "STATUS": "SUCCESS", "RESPONSE": { "UNIQUE_QUERY_ID": … } }
 * This adapter previously read the lead fields off the root object, which
 * meant a real push would have found no SENDER_NAME and been rejected as
 * unparseable. Both shapes are accepted now: the envelope is unwrapped when
 * present, and a bare lead object still works (that's what the in-app test
 * console used, and it costs nothing to keep supporting).
 */
export type IndiaMartPayload = IndiaMartLead & {
  CODE?: number | string;
  STATUS?: string;
  RESPONSE?: IndiaMartLead | IndiaMartLead[];
};

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * The Push API documents QUERY_TIME as "YYYY-MM-DD HH:mm:ss" (e.g.
 * "2024-04-10 11:17:14"); older IndiaMART surfaces use "DD-MMM-YYYY
 * HH:mm:ss". Both are handled explicitly and read as local time — passing
 * the first form to `new Date()` is parsed as UTC by some engines, which
 * would shift every Indian enquiry by 5.5 hours. Anything else falls back to
 * native parsing.
 */
function parseIndiaMartTime(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})[\sT](\d{1,2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (iso) {
    const [, year, month, day, hour, min, sec] = iso;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min), Number(sec));
  }

  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (match) {
    const [, day, monStr, year, hour, min, sec] = match;
    const month = MONTHS[monStr.toLowerCase()];
    if (month != null) {
      return new Date(Number(year), month, Number(day), Number(hour), Number(min), Number(sec));
    }
  }
  const native = new Date(trimmed);
  return Number.isNaN(native.getTime()) ? undefined : native;
}

/**
 * Pulls the lead out of the CODE/STATUS/RESPONSE envelope. A RESPONSE array
 * carrying more than one lead is rejected rather than silently truncated to
 * its first element — losing enquiries quietly is the one outcome this
 * integration exists to prevent, so it goes to the Failed Ingestion queue
 * with a clear reason instead.
 */
function unwrapLead(payload: IndiaMartPayload): { ok: true; lead: IndiaMartLead } | { ok: false; error: string } {
  const response = payload.RESPONSE;
  if (response === undefined || response === null) {
    return { ok: true, lead: payload };
  }
  if (Array.isArray(response)) {
    if (response.length === 0) return { ok: false, error: "RESPONSE array is empty — no lead to import." };
    if (response.length > 1) {
      return { ok: false, error: `RESPONSE contained ${response.length} leads; this endpoint accepts one lead per request.` };
    }
    return { ok: true, lead: response[0] ?? {} };
  }
  if (typeof response !== "object") {
    return { ok: false, error: "RESPONSE must be an object or a single-element array." };
  }
  return { ok: true, lead: response };
}

/** First non-empty trimmed value, else null. */
function firstOf(...values: (string | undefined)[]): string | null {
  for (const v of values) {
    const trimmed = v?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function parseIndiaMartPayload(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Payload must be a JSON object." };
  }
  const payload = raw as IndiaMartPayload;

  const unwrapped = unwrapLead(payload);
  if (!unwrapped.ok) return { ok: false, error: unwrapped.error };
  const lead = unwrapped.lead;

  const customerName = firstOf(lead.SENDER_NAME, lead.SENDER_COMPANY);
  if (!customerName) {
    return { ok: false, error: "Missing SENDER_NAME/SENDER_COMPANY — cannot identify the buyer." };
  }
  const uniqueQueryId = lead.UNIQUE_QUERY_ID?.toString().trim();
  if (!uniqueQueryId) {
    return { ok: false, error: "Missing UNIQUE_QUERY_ID — required for duplicate protection." };
  }

  return {
    ok: true,
    input: {
      source: "INDIAMART",
      externalLeadId: uniqueQueryId,
      customerName,
      companyName: firstOf(lead.SENDER_COMPANY),
      // Alternates are only ever fallbacks — IndiaMART guarantees at least one
      // of SENDER_MOBILE / SENDER_EMAIL, but not which.
      phone: firstOf(lead.SENDER_MOBILE, lead.SENDER_PHONE, lead.SENDER_MOBILE_ALT, lead.SENDER_PHONE_ALT),
      email: firstOf(lead.SENDER_EMAIL, lead.SENDER_EMAIL_ALT),
      city: firstOf(lead.SENDER_CITY),
      state: firstOf(lead.SENDER_STATE),
      product: firstOf(lead.QUERY_PRODUCT_NAME, lead.QUERY_MCAT_NAME),
      requirement: firstOf(lead.QUERY_MESSAGE, lead.SUBJECT),
      quantity: firstOf(lead.QUERY_QUANTITY),
      receivedAt: parseIndiaMartTime(lead.QUERY_TIME),
      // The whole original envelope, so fields with no column of their own
      // (address, pincode, country, query type, mcat) stay auditable on the
      // IngestionRecord rather than being dropped.
      rawData: JSON.stringify(payload),
    },
  };
}

/**
 * Mirrors the real Push API envelope, so "Send Test Payload" exercises the
 * exact shape IndiaMART puts on the wire rather than a convenient flat one.
 */
function sampleIndiaMartPayload(): IndiaMartPayload {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;

  return {
    CODE: 200,
    STATUS: "SUCCESS",
    RESPONSE: {
      UNIQUE_QUERY_ID: `TEST-${Date.now()}`,
      QUERY_TYPE: "W",
      QUERY_TIME: stamp,
      SENDER_NAME: "Ramesh Kulkarni",
      SENDER_COMPANY: "Kulkarni Steel Traders",
      SENDER_MOBILE: "+91-9812345600",
      SENDER_EMAIL: "ramesh@kulkarnisteel.example.in",
      SENDER_ADDRESS: "Plot 14, MIDC Industrial Area, Nashik, Maharashtra",
      SENDER_CITY: "Nashik",
      SENDER_STATE: "Maharashtra",
      SENDER_PINCODE: "422007",
      SENDER_COUNTRY_ISO: "IN",
      SUBJECT: "Requirement for Gate Valve 4 inch",
      QUERY_PRODUCT_NAME: "Gate Valve 4 inch",
      QUERY_MCAT_NAME: "Industrial Valves",
      QUERY_MESSAGE: "Need 30 gate valves for a water treatment plant, please share best price.",
      QUERY_QUANTITY: "30 pieces",
    },
  };
}

export const indiaMartAdapter: ProviderAdapter = {
  type: "INDIAMART",
  slug: "indiamart",
  parse: parseIndiaMartPayload,
  samplePayload: sampleIndiaMartPayload,
};
