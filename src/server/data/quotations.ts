import { prisma } from "@/lib/prisma";
import { getQuotationRisk } from "@/lib/quotationRisk";
import { getCompanyRiskThresholds } from "@/server/data/companySettings";

export async function getQuotationsForCompany(companyId: string) {
  const [quotations, thresholds] = await Promise.all([
    prisma.quotation.findMany({
      where: { lead: { companyId } },
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
  // Quotation has no companyId column of its own — scoped via its lead.
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, lead: { companyId } },
    include: {
      items: { include: { product: true } },
      lead: {
        include: {
          customer: true,
          owner: true,
          company: { select: { lostReasonPresets: true } },
          activities: { include: { user: true }, orderBy: { createdAt: "desc" } },
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
