import { prisma } from "@/lib/prisma";
import { getQuotationRisk } from "@/lib/quotationRisk";
import { getCompanyRiskThresholds } from "@/server/data/companySettings";
import { USER_DISPLAY_SELECT } from "@/server/data/userSelect";

export async function getQuotationsForCompany(companyId: string) {
  const [quotations, thresholds] = await Promise.all([
    prisma.quotation.findMany({
      where: { companyId },
      include: {
        items: true,
        lead: { include: { customer: true, owner: { select: USER_DISPLAY_SELECT } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getCompanyRiskThresholds(companyId),
  ]);

  const now = new Date();
  return quotations.map((quotation) => {
    const risk = getQuotationRisk(
      {
        status: quotation.status,
        value: quotation.value,
        sentAt: quotation.sentAt,
        followUpDate: quotation.followUpDate,
        nextAction: quotation.nextAction,
        updatedAt: quotation.updatedAt,
      },
      now,
      { highValueThreshold: thresholds.highValueThreshold, staleDaysThreshold: thresholds.staleQuotationDays }
    );
    return { ...quotation, risk };
  });
}

export type QuotationWithRisk = Awaited<ReturnType<typeof getQuotationsForCompany>>[number];

export async function getQuotationDetail(quotationId: string, companyId: string) {
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, companyId },
    include: {
      items: { include: { product: true } },
      lead: {
        include: {
          customer: true,
          owner: { select: USER_DISPLAY_SELECT },
          company: { select: { lostReasonPresets: true } },
          activities: { include: { user: { select: USER_DISPLAY_SELECT } }, orderBy: { createdAt: "desc" } },
          quotations: { select: { id: true, status: true } },
        },
      },
    },
  });

  if (!quotation) return null;

  const thresholds = await getCompanyRiskThresholds(companyId);
  const risk = getQuotationRisk(
    {
      status: quotation.status,
      value: quotation.value,
      sentAt: quotation.sentAt,
      followUpDate: quotation.followUpDate,
      nextAction: quotation.nextAction,
      updatedAt: quotation.updatedAt,
    },
    new Date(),
    { highValueThreshold: thresholds.highValueThreshold, staleDaysThreshold: thresholds.staleQuotationDays }
  );

  return { ...quotation, risk };
}

export type QuotationDetail = NonNullable<Awaited<ReturnType<typeof getQuotationDetail>>>;

/** Lead options for the Quotations-page "pick a lead, then build the quote" flow — excludes Lost leads, nothing to quote there. */
export async function getLeadPickerOptions(companyId: string, ownerScope?: string) {
  const leads = await prisma.lead.findMany({
    where: { companyId, status: { not: "LOST" }, ...(ownerScope ? { ownerId: ownerScope } : {}) },
    include: { customer: { select: { name: true } }, owner: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return leads.map((l) => ({
    id: l.id,
    title: l.title,
    customerName: l.customer.name,
    status: l.status,
    ownerId: l.ownerId,
    ownerName: l.owner?.name ?? null,
  }));
}

export type LeadPickerOption = Awaited<ReturnType<typeof getLeadPickerOptions>>[number];

/**
 * A pre-filled quotation number the user can freely edit.
 *
 * This is a pure preview — it reads Company.lastQuotationSequence but never
 * writes it. It used to reserve the number atomically (increment-on-read),
 * but both call sites (the Quotations page and every Lead detail page) load
 * this on every server render, not just when a user opens the create form.
 * Worse, any server action on the lead detail page — changing status,
 * scheduling a follow-up, adding a note, none of them related to quotations
 * at all — triggers a revalidation that re-renders the page and so
 * re-invokes this. In one QA session, three unrelated actions on a lead
 * left the very first quotation created suggested as "QT-2026-0003". A
 * sequence meant to track quotations actually created was advancing on
 * page views instead. See createQuotation, which now does the actual
 * reservation at the point a quotation is genuinely saved.
 *
 * Collision candidates are still checked against existing rows before being
 * returned, for the rare case where a manually-entered number already
 * occupies the next value in sequence. The DB's
 * @@unique([companyId, quotationNumber]) constraint remains the real source
 * of truth for uniqueness; this just makes collisions rare in the common
 * case. Bounded so a pathological run of manual collisions can't loop
 * forever — if the bound is ever hit, the last candidate is returned as-is
 * and createQuotation's P2002 handling remains the actual backstop.
 */
export async function getSuggestedQuotationNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const MAX_ATTEMPTS = 50;
  const company = await prisma.company.findFirstOrThrow({ where: { id: companyId }, select: { lastQuotationSequence: true } });
  let candidate = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const seq = company.lastQuotationSequence + attempt;
    candidate = `QT-${year}-${String(seq).padStart(4, "0")}`;
    const collision = await prisma.quotation.findFirst({ where: { companyId, quotationNumber: candidate }, select: { id: true } });
    if (!collision) return candidate;
  }
  return candidate;
}

/** `QT-<year>-<sequence>` — the auto-suggested format createQuotation checks for below, to keep the counter caught up only when that format was actually used. */
const AUTO_QUOTATION_NUMBER_RE = /^QT-\d{4}-(\d+)$/;

/**
 * Advances Company.lastQuotationSequence to at least the sequence just used,
 * so the next suggestion continues from here — the reservation
 * getSuggestedQuotationNumber used to do on every render, now done exactly
 * once, at the point a quotation is actually created. A plain conditional
 * update (`lt` guard), not an increment, so two concurrent creations can
 * never stomp each other back down to a lower value; whichever finishes last
 * wins, which is exactly what "at least this high" requires.
 *
 * A no-op for hand-typed numbers that don't match the auto format — those
 * were never reserved from this sequence, so there's nothing to catch up to.
 */
export async function advanceQuotationSequence(companyId: string, quotationNumber: string): Promise<void> {
  const match = AUTO_QUOTATION_NUMBER_RE.exec(quotationNumber);
  if (!match) return;
  const usedSequence = Number(match[1]);
  if (!Number.isFinite(usedSequence)) return;
  await prisma.company.updateMany({ where: { id: companyId, lastQuotationSequence: { lt: usedSequence } }, data: { lastQuotationSequence: usedSequence } });
}
