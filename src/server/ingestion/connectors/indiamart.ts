import type { ProviderAdapter, ParseResult } from "./types";

/**
 * IndiaMART's "Buy Lead" push API delivers leads as a flat JSON object with
 * this general shape (field names as commonly documented for their lead-push
 * webhook). This adapter is built against that documented shape — it has
 * never talked to a live IndiaMART account, since no credentials/access have
 * been provided. See ARCHITECTURE.md for what changes once real access
 * exists (almost certainly nothing beyond field-name corrections here).
 */
export type IndiaMartPayload = {
  UNIQUE_QUERY_ID?: string;
  QUERY_TIME?: string;
  SENDER_NAME?: string;
  SENDER_COMPANY?: string;
  SENDER_MOBILE?: string;
  SENDER_EMAIL?: string;
  SENDER_CITY?: string;
  SENDER_STATE?: string;
  QUERY_PRODUCT_NAME?: string;
  QUERY_MESSAGE?: string;
  QUERY_QUANTITY?: string;
};

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** IndiaMART's documented timestamp format is "DD-MMM-YYYY HH:mm:ss"; falls back to native Date parsing. */
function parseIndiaMartTime(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (match) {
    const [, day, monStr, year, hour, min, sec] = match;
    const month = MONTHS[monStr.toLowerCase()];
    if (month != null) {
      return new Date(Number(year), month, Number(day), Number(hour), Number(min), Number(sec));
    }
  }
  const native = new Date(value);
  return Number.isNaN(native.getTime()) ? undefined : native;
}

function parseIndiaMartPayload(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Payload must be a JSON object." };
  }
  const payload = raw as IndiaMartPayload;

  const customerName = (payload.SENDER_NAME || payload.SENDER_COMPANY || "").trim();
  if (!customerName) {
    return { ok: false, error: "Missing SENDER_NAME/SENDER_COMPANY — cannot identify the buyer." };
  }
  if (!payload.UNIQUE_QUERY_ID) {
    return { ok: false, error: "Missing UNIQUE_QUERY_ID — required for duplicate protection." };
  }

  return {
    ok: true,
    input: {
      source: "INDIAMART",
      externalLeadId: payload.UNIQUE_QUERY_ID,
      customerName,
      companyName: payload.SENDER_COMPANY || null,
      phone: payload.SENDER_MOBILE || null,
      email: payload.SENDER_EMAIL || null,
      city: payload.SENDER_CITY || null,
      state: payload.SENDER_STATE || null,
      product: payload.QUERY_PRODUCT_NAME || null,
      requirement: payload.QUERY_MESSAGE || null,
      quantity: payload.QUERY_QUANTITY || null,
      receivedAt: parseIndiaMartTime(payload.QUERY_TIME),
      rawData: JSON.stringify(payload),
    },
  };
}

function sampleIndiaMartPayload(): IndiaMartPayload {
  const now = new Date();
  const stamp = `${String(now.getDate()).padStart(2, "0")}-${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][now.getMonth()]
  }-${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  return {
    UNIQUE_QUERY_ID: `TEST-${Date.now()}`,
    QUERY_TIME: stamp,
    SENDER_NAME: "Ramesh Kulkarni",
    SENDER_COMPANY: "Kulkarni Steel Traders",
    SENDER_MOBILE: "9812345600",
    SENDER_EMAIL: "ramesh@kulkarnisteel.example.in",
    SENDER_CITY: "Nashik",
    SENDER_STATE: "Maharashtra",
    QUERY_PRODUCT_NAME: "Gate Valve 4 inch",
    QUERY_MESSAGE: "Need 30 gate valves for a water treatment plant, please share best price.",
    QUERY_QUANTITY: "30 pieces",
  };
}

export const indiaMartAdapter: ProviderAdapter = {
  type: "INDIAMART",
  slug: "indiamart",
  parse: parseIndiaMartPayload,
  samplePayload: sampleIndiaMartPayload,
};
