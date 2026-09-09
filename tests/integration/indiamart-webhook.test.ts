import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../helpers/setup";
import { ALPHA, BETA } from "../helpers/fixtures";
import { handleWebhookRequest } from "@/server/ingestion/webhookHandler";

/**
 * The security and idempotency guarantees a live IndiaMART connection rests
 * on. The webhook is unauthenticated apart from the random token in its URL,
 * so these are the properties that decide whether a real seller account can
 * be pointed at it safely:
 *
 *  - the token alone decides which workspace a lead lands in (nothing in the
 *    payload can redirect it),
 *  - an unknown token learns nothing and writes nothing,
 *  - a redelivery of the same enquiry cannot become a second lead,
 *  - anything unparseable is preserved in the Failed Ingestion queue rather
 *    than dropped.
 */

const ALPHA_TOKEN = "alpha0token0000000000000000000000000000000000000";
const BETA_TOKEN = "beta0token00000000000000000000000000000000000000";
const DISABLED_TOKEN = "disabled0token00000000000000000000000000000000000";

/** A real IndiaMART Push API envelope. */
function push(uniqueQueryId: string, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    CODE: 200,
    STATUS: "SUCCESS",
    RESPONSE: {
      UNIQUE_QUERY_ID: uniqueQueryId,
      QUERY_TYPE: "W",
      QUERY_TIME: "2026-09-09 11:17:14",
      SENDER_NAME: "Live Buyer",
      SENDER_COMPANY: "Live Buyer Industries",
      SENDER_MOBILE: "+91-9812300011",
      SENDER_EMAIL: "buyer@livebuyer.example.in",
      SENDER_CITY: "Nagpur",
      SENDER_STATE: "Maharashtra",
      QUERY_PRODUCT_NAME: "PVC Resin",
      QUERY_MESSAGE: "Need 2 tons monthly.",
      ...overrides,
    },
  });
}

function seedIntegrations() {
  db.seed("integration", [
    { id: "integration_alpha_im", companyId: ALPHA.companyId, type: "INDIAMART", status: "TEST_MODE", enabled: true, webhookToken: ALPHA_TOKEN, signingSecret: null, totalReceived: 0 },
    { id: "integration_beta_im", companyId: BETA.companyId, type: "INDIAMART", status: "TEST_MODE", enabled: true, webhookToken: BETA_TOKEN, signingSecret: null, totalReceived: 0 },
  ]);
}

const NO_HEADERS = new Headers();

/** Leads that were not part of the seeded fixture set. */
function newLeads() {
  return db.all("lead").filter((l) => l.id !== ALPHA.leadId && l.id !== BETA.leadId);
}

beforeEach(() => {
  seedIntegrations();
});

describe("IndiaMART webhook — tenant routing", () => {
  it("routes a real push to the workspace that owns the token", async () => {
    const result = await handleWebhookRequest("indiamart", ALPHA_TOKEN, push("Q-1"), NO_HEADERS);

    expect(result.httpStatus).toBe(201);
    expect(result.body.status).toBe("created");

    const created = newLeads();
    expect(created).toHaveLength(1);
    expect(created[0].companyId).toBe(ALPHA.companyId);
    expect(created[0].source).toBe("INDIAMART");
  });

  it("sends an identical payload to a different workspace when a different token is used", async () => {
    await handleWebhookRequest("indiamart", BETA_TOKEN, push("Q-2"), NO_HEADERS);

    const created = newLeads();
    expect(created).toHaveLength(1);
    expect(created[0].companyId).toBe(BETA.companyId);
  });

  it("ignores any company identifier smuggled into the payload — the token decides", async () => {
    const spoofed = JSON.stringify({
      CODE: 200,
      companyId: BETA.companyId,
      RESPONSE: { UNIQUE_QUERY_ID: "Q-3", SENDER_NAME: "Spoofer", companyId: BETA.companyId },
    });

    await handleWebhookRequest("indiamart", ALPHA_TOKEN, spoofed, NO_HEADERS);

    const created = newLeads();
    expect(created).toHaveLength(1);
    expect(created[0].companyId).toBe(ALPHA.companyId);
  });

  it("cannot have its lead owner set from the payload", async () => {
    const spoofed = JSON.stringify({
      RESPONSE: { UNIQUE_QUERY_ID: "Q-4", SENDER_NAME: "Owner Spoofer", assignToUserId: BETA.salespersonId, ownerId: BETA.salespersonId },
    });

    await handleWebhookRequest("indiamart", ALPHA_TOKEN, spoofed, NO_HEADERS);

    const created = newLeads();
    expect(created).toHaveLength(1);
    expect(created[0].ownerId ?? null).toBeNull();
  });

  it("attributes the ingestion activity to the system, not to any user", async () => {
    await handleWebhookRequest("indiamart", ALPHA_TOKEN, push("Q-5"), NO_HEADERS);

    const lead = newLeads()[0];
    const activity = db.all("activity").find((a) => a.leadId === lead.id);
    expect(activity).toBeTruthy();
    expect(activity!.userId ?? null).toBeNull();
  });
});

describe("IndiaMART webhook — rejected requests", () => {
  it("rejects an unknown token without creating anything or confirming the token exists", async () => {
    const result = await handleWebhookRequest("indiamart", "not-a-real-token", push("Q-6"), NO_HEADERS);

    expect(result.httpStatus).toBe(404);
    expect(JSON.stringify(result.body)).not.toContain("not-a-real-token");
    expect(newLeads()).toHaveLength(0);
    expect(db.all("failedIngestion")).toHaveLength(0);
  });

  it("rejects an unknown provider slug", async () => {
    const result = await handleWebhookRequest("not-a-provider", ALPHA_TOKEN, push("Q-7"), NO_HEADERS);

    expect(result.httpStatus).toBe(404);
    expect(newLeads()).toHaveLength(0);
  });

  it("refuses to ingest while the integration is disabled", async () => {
    db.seed("integration", [
      { id: "integration_disabled_im", companyId: ALPHA.companyId, type: "INDIAMART", status: "TEST_MODE", enabled: false, webhookToken: DISABLED_TOKEN, signingSecret: null, totalReceived: 0 },
    ]);

    const result = await handleWebhookRequest("indiamart", DISABLED_TOKEN, push("Q-8"), NO_HEADERS);

    expect(result.httpStatus).toBe(403);
    expect(newLeads()).toHaveLength(0);
  });
});

describe("IndiaMART webhook — nothing is silently dropped", () => {
  it("keeps malformed JSON in the Failed Ingestion queue", async () => {
    const result = await handleWebhookRequest("indiamart", ALPHA_TOKEN, "{not json at all", NO_HEADERS);

    expect(result.httpStatus).toBe(400);
    const failures = db.all("failedIngestion");
    expect(failures).toHaveLength(1);
    expect(failures[0].companyId).toBe(ALPHA.companyId);
    expect(newLeads()).toHaveLength(0);
  });

  it("keeps a well-formed but unusable payload in the Failed Ingestion queue", async () => {
    const result = await handleWebhookRequest(
      "indiamart",
      ALPHA_TOKEN,
      JSON.stringify({ CODE: 200, RESPONSE: { UNIQUE_QUERY_ID: "Q-9" } }),
      NO_HEADERS
    );

    expect(result.httpStatus).toBe(400);
    const failures = db.all("failedIngestion");
    expect(failures).toHaveLength(1);
    expect(failures[0].companyId).toBe(ALPHA.companyId);
    expect(String(failures[0].errorMessage)).toContain("SENDER_NAME");
    expect(newLeads()).toHaveLength(0);
  });
});

describe("IndiaMART webhook — duplicate delivery", () => {
  it("does not create a second lead when IndiaMART redelivers the same enquiry", async () => {
    const first = await handleWebhookRequest("indiamart", ALPHA_TOKEN, push("REPEAT-1"), NO_HEADERS);
    const second = await handleWebhookRequest("indiamart", ALPHA_TOKEN, push("REPEAT-1"), NO_HEADERS);

    expect(first.httpStatus).toBe(201);
    expect(first.body.status).toBe("created");

    // A retry must be acknowledged, not error — otherwise IndiaMART keeps retrying.
    expect(second.httpStatus).toBe(200);
    expect(second.body.status).toBe("duplicate");

    expect(newLeads()).toHaveLength(1);
  });

  it("scopes duplicate detection per workspace — the same enquiry id in another tenant is untouched", async () => {
    await handleWebhookRequest("indiamart", ALPHA_TOKEN, push("SHARED-ID"), NO_HEADERS);
    const other = await handleWebhookRequest("indiamart", BETA_TOKEN, push("SHARED-ID"), NO_HEADERS);

    expect(other.httpStatus).toBe(201);
    const created = newLeads();
    expect(created).toHaveLength(2);
    expect(created.map((l) => l.companyId).sort()).toEqual([ALPHA.companyId, BETA.companyId].sort());
  });
});
