import { describe, it, expect } from "vitest";
import { db, signInAs } from "../helpers/setup";
import { ALPHA, BETA } from "../helpers/fixtures";
import { ingestLead } from "@/server/ingestion/pipeline";
import { createManualLead, importCsvLeads, type ManualLeadFormInput } from "@/server/actions/ingestion";
import type { NormalizedLeadInput } from "@/server/ingestion/types";

/**
 * `ingestLead` is the single write path for every lead, and it is called
 * directly here — deliberately bypassing the server actions — because the
 * point is that the shared function defends its own tenant invariant rather
 * than trusting each caller to have checked first.
 */
function input(overrides: Partial<NormalizedLeadInput> = {}): NormalizedLeadInput {
  return {
    source: "MANUAL",
    customerName: "Pipeline Buyer",
    companyName: "Pipeline Buyer Pvt Ltd",
    phone: "9222222222",
    email: "buyer@pipeline.test",
    city: "Pune",
    state: "MH",
    requirement: "Need pricing",
    product: "Resin",
    quantity: "5 kg",
    estimatedValue: 25000,
    nextAction: "Call back",
    nextActionDeadline: new Date("2026-12-01"),
    ...overrides,
  };
}

async function batchFor(companyId: string): Promise<string> {
  const client = db.client() as { ingestionBatch: { create: (a: unknown) => Promise<{ id: string }> } };
  const batch = await client.ingestionBatch.create({
    data: { companyId, source: "MANUAL", triggeredById: null, recordsReceived: 1 },
  });
  return batch.id;
}

describe("ingestLead validates ownerId itself", () => {
  it("rejects an assignee from another company", async () => {
    const batchId = await batchFor(ALPHA.companyId);

    const result = await ingestLead(ALPHA.companyId, batchId, input({ assignToUserId: BETA.salespersonId }), null);

    expect(result.status).toBe("invalid");
    expect(result.errors?.join(" ")).toMatch(/does not belong to this company/i);
    // No lead was written at all — not merely one with a blanked owner.
    expect(db.all("lead")).toHaveLength(2);
    expect(db.all("lead").some((l) => l.ownerId === BETA.salespersonId && l.companyId === ALPHA.companyId)).toBe(false);
  });

  it("records the rejected row so it is auditable rather than silently dropped", async () => {
    const batchId = await batchFor(ALPHA.companyId);

    await ingestLead(ALPHA.companyId, batchId, input({ assignToUserId: BETA.salespersonId }), null);

    const record = db.all("ingestionRecord").find((r) => r.status === "INVALID");
    expect(record).toBeDefined();
    expect(record!.companyId).toBe(ALPHA.companyId);
  });

  it("accepts an assignee from the same company", async () => {
    const batchId = await batchFor(ALPHA.companyId);

    const result = await ingestLead(ALPHA.companyId, batchId, input({ assignToUserId: ALPHA.salespersonId }), null);

    expect(result.status).toBe("created");
    const created = db.all("lead").find((l) => l.id !== ALPHA.leadId && l.id !== BETA.leadId)!;
    expect(created.ownerId).toBe(ALPHA.salespersonId);
    expect(created.companyId).toBe(ALPHA.companyId);
  });

  it("still allows an unassigned lead", async () => {
    const batchId = await batchFor(ALPHA.companyId);

    const result = await ingestLead(ALPHA.companyId, batchId, input({ assignToUserId: null }), null);

    expect(result.status).toBe("created");
    const created = db.all("lead").find((l) => l.id !== ALPHA.leadId && l.id !== BETA.leadId)!;
    expect(created.ownerId).toBeNull();
  });
});

describe("existing callers still behave correctly", () => {
  const form: ManualLeadFormInput = {
    customerName: "Caller Buyer",
    companyName: "Caller Pvt Ltd",
    phone: "9333333333",
    email: "caller@buyer.test",
    city: "Pune",
    state: "MH",
    source: "MANUAL",
    product: "Resin",
    quantity: "5 kg",
    requirement: "Need a quote",
    estimatedValue: "30000",
    assignToUserId: "",
    priority: "MEDIUM",
    nextAction: "Call back",
    nextActionDeadline: "2026-12-01",
  };

  it("createManualLead still creates an assigned lead", async () => {
    signInAs(ALPHA.ownerId);

    const result = await createManualLead({ ...form, assignToUserId: ALPHA.salespersonId });

    expect(result.status).toBe("created");
    const created = db.all("lead").find((l) => l.id !== ALPHA.leadId && l.id !== BETA.leadId)!;
    expect(created.ownerId).toBe(ALPHA.salespersonId);
  });

  it("createManualLead still reports its own message for a foreign assignee", async () => {
    signInAs(ALPHA.ownerId);

    const result = await createManualLead({ ...form, assignToUserId: BETA.salespersonId });

    // The caller's check fires first, so its wording is preserved.
    expect(result.status).toBe("invalid");
    expect(result).toHaveProperty("errors", ["Selected salesperson not found."]);
  });

  it("importCsvLeads still imports rows, dropping a foreign assignee", async () => {
    signInAs(ALPHA.ownerId);

    const summary = await importCsvLeads("leads.csv", "CSV_IMPORT", [
      { customerName: "Csv A", source: "CSV_IMPORT", assignToUserId: ALPHA.salespersonId },
      { customerName: "Csv B", source: "CSV_IMPORT", assignToUserId: BETA.salespersonId },
    ]);

    // Both rows import: the CSV path nulls an unknown assignee before
    // ingesting, so the new guard never sees a foreign id and nothing regresses.
    expect(summary.created).toBe(2);
    const created = db.all("lead").filter((l) => l.id !== ALPHA.leadId && l.id !== BETA.leadId);
    expect(created).toHaveLength(2);
    expect(created.some((l) => l.ownerId === BETA.salespersonId)).toBe(false);
  });
});
