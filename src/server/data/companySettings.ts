import { prisma } from "@/lib/prisma";

export type CompanyRiskThresholds = { highValueThreshold: number; staleQuotationDays: number };

/** Company-configured thresholds (Phase 10 settings) that feed leadRisk.ts/quotationRisk.ts, so risk flags reflect what each company actually considers high-value/stale rather than a hardcoded default. */
export async function getCompanyRiskThresholds(companyId: string): Promise<CompanyRiskThresholds> {
  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { highValueThreshold: true, staleQuotationDays: true },
  });
  return { highValueThreshold: company?.highValueThreshold ?? 50000, staleQuotationDays: company?.staleQuotationDays ?? 10 };
}
