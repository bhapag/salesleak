import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type CompanyRiskThresholds = { highValueThreshold: number; staleQuotationDays: number };
export type CompanyRuntimeSettings = CompanyRiskThresholds & { timezone: string };

/**
 * The small set of Company fields that half a dozen data loaders each need
 * per request (timezone for day-boundary math, thresholds for risk flags).
 * Before this, every loader ran its own ad-hoc `company.findFirst` for
 * whichever field it needed — harmless on a fast local DB, but each one is
 * a full network round trip, and composers like getMyDayData() that call
 * 3-4 loaders in the same request paid for the same Company row 3-4 times
 * over. Wrapped in React's cache() (the same pattern getSession() already
 * uses) so every caller within one request/render pass shares one query.
 */
export const getCompanyRuntimeSettings = cache(async (companyId: string): Promise<CompanyRuntimeSettings> => {
  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { timezone: true, highValueThreshold: true, staleQuotationDays: true },
  });
  return {
    timezone: company?.timezone ?? "Asia/Kolkata",
    highValueThreshold: company?.highValueThreshold ?? 50000,
    staleQuotationDays: company?.staleQuotationDays ?? 10,
  };
});

/** Company-configured thresholds (Phase 10 settings) that feed leadRisk.ts/quotationRisk.ts, so risk flags reflect what each company actually considers high-value/stale rather than a hardcoded default. */
export async function getCompanyRiskThresholds(companyId: string): Promise<CompanyRiskThresholds> {
  const { highValueThreshold, staleQuotationDays } = await getCompanyRuntimeSettings(companyId);
  return { highValueThreshold, staleQuotationDays };
}
