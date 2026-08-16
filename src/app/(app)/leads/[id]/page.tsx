import { notFound } from "next/navigation";
import { getLeadDetail } from "@/server/data/leads";
import { getCachedInsight } from "@/server/data/ai";
import { getProductsForCompany } from "@/server/data/products";
import { getSuggestedQuotationNumber } from "@/server/data/quotations";
import { prisma } from "@/lib/prisma";
import { LeadDetailView } from "@/components/leads/LeadDetailView";
import { requireSession } from "@/server/auth/session";
import type { LeadInsightsData } from "@/components/ai/AiLeadInsightsCard";
import type { LeadInsights } from "@/server/ai/features/leadInsights";

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ newQuotation?: string }>;
}) {
  const { id } = await params;
  const { newQuotation } = await searchParams;
  const session = await requireSession();

  const lead = await getLeadDetail(id, session.companyId);
  if (!lead) notFound();

  const [users, cachedInsight, products, suggestedQuotationNumber] = await Promise.all([
    prisma.user.findMany({ where: { companyId: lead.companyId }, orderBy: { name: "asc" } }),
    getCachedInsight(session.companyId, "LEAD_INSIGHTS", "Lead", id),
    getProductsForCompany(session.companyId),
    getSuggestedQuotationNumber(session.companyId),
  ]);

  // A plain DB read, not an AI call — the card only calls out to AI when the
  // user clicks Generate/Regenerate, or if this cache is stale for the
  // current lead state (checked again server-side at that point).
  const initialInsight: LeadInsightsData | null = cachedInsight
    ? { ...(JSON.parse(cachedInsight.content) as LeadInsights), mocked: cachedInsight.mocked, generatedAt: cachedInsight.updatedAt }
    : null;

  return (
    <LeadDetailView
      lead={lead}
      users={users.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
      currentUserId={session.userId}
      initialInsight={initialInsight}
      products={products}
      suggestedQuotationNumber={suggestedQuotationNumber}
      autoOpenQuotationForm={newQuotation === "1"}
    />
  );
}
