import { describe, it, expect } from "vitest";
import { indiaMartAdapter } from "@/server/ingestion/connectors/indiamart";

/**
 * Regression coverage for a defect found while connecting a real IndiaMART
 * seller account: the Push API posts the lead inside a CODE/STATUS/RESPONSE
 * envelope, but this adapter read the lead fields off the root object. Every
 * genuine IndiaMART push would therefore have been rejected as "Missing
 * SENDER_NAME/SENDER_COMPANY" and dropped into the Failed Ingestion queue —
 * the integration would have looked configured and delivered nothing.
 *
 * Field names and the envelope shape are from IndiaMART's published Push API
 * documentation ("Integration of IndiaMART's Lead Manager CRM Push API with
 * Third Party CRMs – Real-time Push of Leads").
 */

/** The documented real-world shape, as IndiaMART sends it. */
function pushEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    CODE: 200,
    STATUS: "SUCCESS",
    RESPONSE: {
      UNIQUE_QUERY_ID: "621654886",
      QUERY_TYPE: "B",
      QUERY_TIME: "2024-04-10 11:17:14",
      SENDER_NAME: "Prabhat",
      SENDER_COMPANY: "Prabhat Traders",
      SENDER_MOBILE: "+91-9999999999",
      SENDER_EMAIL: "prabhat@example.in",
      SENDER_ADDRESS: "12 GT Road, Kanpur, Uttar Pradesh",
      SENDER_CITY: "Kanpur",
      SENDER_STATE: "Uttar Pradesh",
      SENDER_PINCODE: "208001",
      SENDER_COUNTRY_ISO: "IN",
      SUBJECT: "Requirement for PVC Resin",
      QUERY_PRODUCT_NAME: "PVC Resin",
      QUERY_MCAT_NAME: "Polymer Resins",
      QUERY_MESSAGE: "Need 5 tons of PVC resin monthly, share best rate.",
      ...overrides,
    },
  };
}

describe("IndiaMART Push API adapter", () => {
  it("parses the real CODE/STATUS/RESPONSE envelope IndiaMART actually sends", () => {
    const result = indiaMartAdapter.parse(pushEnvelope());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.customerName).toBe("Prabhat");
    expect(result.input.externalLeadId).toBe("621654886");
    expect(result.input.source).toBe("INDIAMART");
  });

  it("preserves geography — city and state survive the mapping", () => {
    const result = indiaMartAdapter.parse(pushEnvelope());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.city).toBe("Kanpur");
    expect(result.input.state).toBe("Uttar Pradesh");
  });

  it("maps contact, product and enquiry text from the documented fields", () => {
    const result = indiaMartAdapter.parse(pushEnvelope());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.phone).toBe("+91-9999999999");
    expect(result.input.email).toBe("prabhat@example.in");
    expect(result.input.companyName).toBe("Prabhat Traders");
    expect(result.input.product).toBe("PVC Resin");
    expect(result.input.requirement).toBe("Need 5 tons of PVC resin monthly, share best rate.");
  });

  it("keeps fields with no column of their own (address, pincode, country) in rawData", () => {
    const result = indiaMartAdapter.parse(pushEnvelope());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.rawData).toContain("208001");
    expect(result.input.rawData).toContain("SENDER_COUNTRY_ISO");
  });

  /**
   * Found by a live round-trip against the deployed webhook: QUERY_TIME was
   * built with `new Date(y, m, d, …)`, i.e. in the *server's* timezone. That
   * is only correct on an IST server; Vercel runs UTC, so a 14:32 IST enquiry
   * was stored as 14:32 UTC — 5.5 hours in the future. Lead age, overdue
   * detection and Money at Risk all key off that timestamp.
   *
   * These assertions compare absolute instants (UTC), so they fail on an
   * IST machine too — the previous local-getter assertions passed on IST and
   * were exactly what hid the bug.
   */
  it("reads QUERY_TIME as IST regardless of the server's own timezone", () => {
    const result = indiaMartAdapter.parse(pushEnvelope());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2024-04-10 11:17:14 IST === 05:47:14 UTC
    expect(result.input.receivedAt!.toISOString()).toBe("2024-04-10T05:47:14.000Z");
  });

  it("reads the legacy DD-MMM-YYYY format as IST too", () => {
    const result = indiaMartAdapter.parse(pushEnvelope({ QUERY_TIME: "10-Apr-2024 11:17:14" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.receivedAt!.toISOString()).toBe("2024-04-10T05:47:14.000Z");
  });

  it("does not shift an enquiry into the future (the Vercel-UTC regression)", () => {
    const result = indiaMartAdapter.parse(pushEnvelope({ QUERY_TIME: "2026-09-09 14:32:05" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The bug stored this as 14:32:05Z. Correct is 09:02:05Z.
    expect(result.input.receivedAt!.toISOString()).toBe("2026-09-09T09:02:05.000Z");
    expect(result.input.receivedAt!.toISOString()).not.toBe("2026-09-09T14:32:05.000Z");
  });

  it("round-trips its own sample payload's timestamp to within a few seconds of now", () => {
    const sample = indiaMartAdapter.samplePayload();
    const result = indiaMartAdapter.parse(sample);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Would be off by 5.5 hours in either direction if either the stamp or
    // the parse assumed the server's timezone.
    const skewMs = Math.abs(Date.now() - result.input.receivedAt!.getTime());
    expect(skewMs).toBeLessThan(60_000);
  });

  it("falls back to the alternate phone/email fields when the primaries are absent", () => {
    const result = indiaMartAdapter.parse(
      pushEnvelope({ SENDER_MOBILE: "", SENDER_EMAIL: "", SENDER_PHONE: "0512-2345678", SENDER_EMAIL_ALT: "alt@example.in" })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.phone).toBe("0512-2345678");
    expect(result.input.email).toBe("alt@example.in");
  });

  it("still accepts a bare lead object (what the in-app test console used to send)", () => {
    const result = indiaMartAdapter.parse({
      UNIQUE_QUERY_ID: "FLAT-1",
      SENDER_NAME: "Flat Shape",
      SENDER_CITY: "Pune",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.customerName).toBe("Flat Shape");
    expect(result.input.city).toBe("Pune");
  });

  it("unwraps a single-element RESPONSE array", () => {
    const result = indiaMartAdapter.parse({
      CODE: 200,
      RESPONSE: [{ UNIQUE_QUERY_ID: "ARR-1", SENDER_NAME: "Array Buyer" }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.externalLeadId).toBe("ARR-1");
  });

  it("refuses a multi-lead RESPONSE rather than silently importing only the first", () => {
    const result = indiaMartAdapter.parse({
      CODE: 200,
      RESPONSE: [
        { UNIQUE_QUERY_ID: "A", SENDER_NAME: "First" },
        { UNIQUE_QUERY_ID: "B", SENDER_NAME: "Second" },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("2 leads");
  });

  it("refuses a payload with no UNIQUE_QUERY_ID, since duplicate protection depends on it", () => {
    const result = indiaMartAdapter.parse(pushEnvelope({ UNIQUE_QUERY_ID: "" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("UNIQUE_QUERY_ID");
  });

  it("refuses a payload with no identifiable buyer", () => {
    const result = indiaMartAdapter.parse(pushEnvelope({ SENDER_NAME: "", SENDER_COMPANY: "" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("SENDER_NAME");
  });

  it("its own sample payload uses the real envelope and parses cleanly", () => {
    const result = indiaMartAdapter.parse(indiaMartAdapter.samplePayload());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.city).toBe("Nashik");
    expect(result.input.externalLeadId).toBeTruthy();
  });
});
