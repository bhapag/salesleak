import { describe, it, expect } from "vitest";
import { db, signInAs } from "../helpers/setup";
import { ALPHA, BETA } from "../helpers/fixtures";
import { ForbiddenError } from "@/server/auth/permissions";
import { createManualLead, importCsvLeads, getExistingContactsForImportPreview, type ManualLeadFormInput } from "@/server/actions/ingestion";
import { getLeadInsights, getCustomerInsights } from "@/server/actions/ai";

const BLANK_FORM: ManualLeadFormInput = {
  customerName: "New Buyer",
  companyName: "New Buyer Pvt Ltd",
  phone: "9111111111",
  email: "new@buyer.test",
  city: "Pune",
  state: "MH",
  source: "MANUAL",
  product: "Resin",
  quantity: "10 kg",
  requirement: "Need a quote",
  estimatedValue: "50000",
  assignToUserId: "",
  priority: "MEDIUM",
  nextAction: "Call back",
  nextActionDeadline: "2026-12-01",
};

/**
 * Ingestion is the one path where a lead is created from scratch, so the
 * company it lands in comes entirely from the session — there is no
 * client-supplied companyId to test. What can be supplied is the assignee,
 * which is the boundary these cover.
 */
describe("Manual lead ingestion", () => {
  it("refuses an assignee from another company", async () => {
    signInAs(ALPHA.ownerId);

    const result = await createManualLead({ ...BLANK_FORM, assignToUserId: BETA.salespersonId });

    expect(result.status).toBe("invalid");
    expect(db.all("lead").some((l) => l.ownerId === BETA.salespersonId && l.companyId === ALPHA.companyId)).toBe(false);
    expect(db.all("lead")).toHaveLength(2);
  });

  it("creates the lead in the caller's own company", async () => {
    signInAs(ALPHA.ownerId);

    const result = await createManualLead(BLANK_FORM);

    expect(result.status).toBe("created");
    const created = db.all("lead").find((l) => l.title !== "Alpha enquiry" && l.title !== "Beta enquiry")!;
    expect(created.companyId).toBe(ALPHA.companyId);
  });

  it("accepts an assignee from the caller's own company", async () => {
    signInAs(ALPHA.ownerId);

    const result = await createManualLead({ ...BLANK_FORM, assignToUserId: ALPHA.salespersonId });

    expect(result.status).toBe("created");
    const created = db.all("lead").find((l) => l.id !== ALPHA.leadId && l.id !== BETA.leadId)!;
    expect(created.companyId).toBe(ALPHA.companyId);
    expect(created.ownerId).toBe(ALPHA.salespersonId);
  });

  it("records the ingestion batch against the caller's company", async () => {
    signInAs(ALPHA.ownerId);

    await createManualLead(BLANK_FORM);

    const batch = db.all("ingestionBatch")[0];
    expect(batch.companyId).toBe(ALPHA.companyId);
    expect(batch.triggeredById).toBe(ALPHA.ownerId);
  });
});

describe("CSV import", () => {
  it("drops a cross-company assignee rather than honouring it", async () => {
    signInAs(ALPHA.ownerId);

    await importCsvLeads("leads.csv", "CSV_IMPORT", [
      { customerName: "Csv Buyer", source: "CSV_IMPORT", assignToUserId: BETA.salespersonId },
    ]);

    const created = db.all("lead").find((l) => l.id !== ALPHA.leadId && l.id !== BETA.leadId);
    expect(created).toBeDefined();
    expect(created!.companyId).toBe(ALPHA.companyId);
    // The Beta user id was silently discarded, not persisted.
    expect(created!.ownerId).toBeNull();
  });

  it("keeps a same-company assignee", async () => {
    signInAs(ALPHA.ownerId);

    await importCsvLeads("leads.csv", "CSV_IMPORT", [
      { customerName: "Csv Buyer Two", source: "CSV_IMPORT", assignToUserId: ALPHA.salespersonId },
    ]);

    const created = db.all("lead").find((l) => l.id !== ALPHA.leadId && l.id !== BETA.leadId)!;
    expect(created.ownerId).toBe(ALPHA.salespersonId);
    expect(created.companyId).toBe(ALPHA.companyId);
  });

  it("the duplicate-check preview never returns another company's contacts", async () => {
    signInAs(ALPHA.ownerId);

    const contacts = await getExistingContactsForImportPreview();

    expect(contacts.map((c) => c.customerName)).toContain("Alpha Customer");
    expect(contacts.map((c) => c.customerName)).not.toContain("Beta Customer");
  });
});

describe("AI actions are tenant-scoped before any model call", () => {
  it("getLeadInsights refuses another company's lead", async () => {
    signInAs(ALPHA.ownerId);
    await expect(getLeadInsights(BETA.leadId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("getCustomerInsights refuses another company's customer", async () => {
    signInAs(ALPHA.ownerId);
    await expect(getCustomerInsights(BETA.customerId)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
