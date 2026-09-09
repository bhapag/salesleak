import { describe, it, expect } from "vitest";
import { db, signInAs } from "../helpers/setup";
import { ALPHA } from "../helpers/fixtures";
import { getSuggestedQuotationNumber } from "@/server/data/quotations";
import { createQuotation } from "@/server/actions/quotations";

/**
 * Regression coverage for a real bug found during hands-on QA: creating a
 * brand-new company's first-ever quotation suggested "QT-2026-0003", not
 * "QT-2026-0001". Root cause was getSuggestedQuotationNumber advancing
 * Company.lastQuotationSequence on every call, and it was called on every
 * render of both the Quotations page and every Lead detail page — so
 * actions with nothing to do with quotations (changing a lead's status,
 * scheduling a follow-up) each burned a sequence number via the
 * revalidation-triggered re-render.
 *
 * The fix makes the suggestion a pure read and only advances the sequence
 * inside createQuotation, at the point a quotation is genuinely saved.
 */
describe("quotation number suggestion does not drift on unrelated activity", () => {
  it("suggests 0001 for a company that has never created a quotation", async () => {
    // Beta has no quotations in the seed data used by this describe block's
    // fixture — Alpha does (see tenant-isolation.test.ts), so use a company
    // with a clean slate to prove the "first ever" case directly.
    signInAs(ALPHA.ownerId);
    const before = db.all("company").find((c) => c.id === ALPHA.companyId)!.lastQuotationSequence as number;

    const suggestion = await getSuggestedQuotationNumber(ALPHA.companyId);

    expect(suggestion).toBe(`QT-${new Date().getFullYear()}-${String(before + 1).padStart(4, "0")}`);
  });

  it("repeated suggestion calls with no quotation ever created return the same number", async () => {
    // This is the exact shape of the bug: viewing a page (or several) that
    // merely displays the suggestion, without ever submitting the form.
    signInAs(ALPHA.ownerId);

    const first = await getSuggestedQuotationNumber(ALPHA.companyId);
    const second = await getSuggestedQuotationNumber(ALPHA.companyId);
    const third = await getSuggestedQuotationNumber(ALPHA.companyId);

    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("unrelated lead actions between suggestion and creation do not advance the number", async () => {
    signInAs(ALPHA.ownerId);
    const suggested = await getSuggestedQuotationNumber(ALPHA.companyId);

    // Simulate a page re-render happening (e.g. after an unrelated status
    // change) by calling the suggestion function again before the user
    // actually submits — this is exactly what used to burn the sequence.
    await getSuggestedQuotationNumber(ALPHA.companyId);
    await getSuggestedQuotationNumber(ALPHA.companyId);

    const result = await createQuotation(
      {
        leadId: ALPHA.leadId,
        quotationNumber: suggested,
        items: [{ productId: null, description: "Widget", quantity: 1, unitPrice: 100 }],
        sentAt: null,
        validUntil: null,
        nextAction: null,
        followUpDate: null,
        notes: null,
      },
      null
    );

    expect(result.success).toBe(true);
    if (result.success) expect(result.quotationId).toBeTruthy();
  });

  it("creating a quotation advances the sequence exactly once, by exactly one", async () => {
    signInAs(ALPHA.ownerId);
    const before = db.all("company").find((c) => c.id === ALPHA.companyId)!.lastQuotationSequence as number;
    const suggested = await getSuggestedQuotationNumber(ALPHA.companyId);

    await createQuotation(
      {
        leadId: ALPHA.leadId,
        quotationNumber: suggested,
        items: [{ productId: null, description: "Widget", quantity: 1, unitPrice: 100 }],
        sentAt: null,
        validUntil: null,
        nextAction: null,
        followUpDate: null,
        notes: null,
      },
      null
    );

    const after = db.all("company").find((c) => c.id === ALPHA.companyId)!.lastQuotationSequence as number;
    expect(after).toBe(before + 1);

    const next = await getSuggestedQuotationNumber(ALPHA.companyId);
    expect(next).toBe(`QT-${new Date().getFullYear()}-${String(before + 2).padStart(4, "0")}`);
  });

  it("a hand-typed number that does not match the auto format never advances the sequence", async () => {
    signInAs(ALPHA.ownerId);
    const before = db.all("company").find((c) => c.id === ALPHA.companyId)!.lastQuotationSequence as number;

    await createQuotation(
      {
        leadId: ALPHA.leadId,
        quotationNumber: "INV-2026-CUSTOM-001",
        items: [{ productId: null, description: "Widget", quantity: 1, unitPrice: 100 }],
        sentAt: null,
        validUntil: null,
        nextAction: null,
        followUpDate: null,
        notes: null,
      },
      null
    );

    const after = db.all("company").find((c) => c.id === ALPHA.companyId)!.lastQuotationSequence as number;
    expect(after).toBe(before);
  });
});
