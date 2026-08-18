import { prisma } from "@/lib/prisma";
import { getQuotationRisk } from "@/lib/quotationRisk";
import { getCompanyRiskThresholds } from "@/server/data/companySettings";

export async function getQuotationsForCompany(companyId: string) {
  const [quotations, thresholds] = await Promise.all([
    prisma.quotation.findMany({
      where: { companyId },
      include: {
        items: true,
        lead: { include: { customer: true, owner: true } },
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
          owner: true,
          company: { select: { lostReasonPresets: true } },
          activities: { include: { user: true }, orderBy: { createdAt: "desc" } },
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
 * A pre-filled quotation number the user can freely edit. The number is
 * reserved atomically here (via Company.lastQuotationSequence) rather than
 * merely "peeked" from a count — two concurrent page loads/creations always
 * get different numbers, at the cost of an occasional gap if a form is
 * abandoned without saving (the standard invoicing-system tradeoff). The DB's
 * @@unique([companyId, quotationNumber]) constraint is the actual source of
 * truth for uniqueness; this just makes collisions rare in the common case.
 *
 * Each candidate is checked against existing rows before being returned —
 * a defensive skip for the rare case where a manually-entered number happens
 * to already occupy the auto sequence's next value (concurrent siblings
 * never collide with each other here, since each gets its own atomically
 * incremented value; this only guards against pre-existing rows). Bounded so
 * a pathological run of manual collisions can't loop forever — if the bound
 * is ever hit, the last candidate is returned as-is and createQuotation's
 * P2002 handling remains the actual backstop.
 */
export async function getSuggestedQuotationNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const MAX_ATTEMPTS = 50;
  let candidate = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const company = await prisma.company.update({
      where: { id: companyId },
      data: { lastQuotationSequence: { increment: 1 } },
      select: { lastQuotationSequence: true },
    });
    candidate = `QT-${year}-${String(company.lastQuotationSequence).padStart(4, "0")}`;
    const collision = await prisma.quotation.findFirst({ where: { companyId, quotationNumber: candidate }, select: { id: true } });
    if (!collision) return candidate;
  }
  return candidate;
}
