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

  it("reads QUERY_TIME's documented YYYY-MM-DD HH:mm:ss format as local time", () => {
    const result = indiaMartAdapter.parse(pushEnvelope());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const received = result.input.receivedAt!;
    expect(received.getFullYear()).toBe(2024);
    expect(received.getMonth()).toBe(3); // April
    expect(received.getDate()).toBe(10);
    expect(received.getHours()).toBe(11);
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
