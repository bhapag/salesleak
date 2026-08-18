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
 */
export async function getSuggestedQuotationNumber(companyId: string): Promise<string> {
  const company = await prisma.company.update({
    where: { id: companyId },
    data: { lastQuotationSequence: { increment: 1 } },
    select: { lastQuotationSequence: true },
  });
  return `QT-${new Date().getFullYear()}-${String(company.lastQuotationSequence).padStart(4, "0")}`;
}
