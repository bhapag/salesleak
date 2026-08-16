"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/permissions";
import { getLeadDetail } from "@/server/data/leads";
import { getCustomerDetail } from "@/server/data/customers";
import { getDashboardData } from "@/server/data/metrics";
import { getCachedInsight, upsertInsight } from "@/server/data/ai";
import { scheduleFollowUp } from "@/server/actions/leads";
import { extractEnquiry, type ExtractedEnquiry } from "@/server/ai/features/enquiryExtraction";
import { generateLeadInsights, type LeadInsights, type LeadInsightInput } from "@/server/ai/features/leadInsights";
import { generateCustomerSummary, type CustomerSummaryResult, type CustomerSummaryInput } from "@/server/ai/features/customerSummary";
import { generateSalesBrief, type SalesBriefResult, type SalesBriefInput } from "@/server/ai/features/salesBrief";

const DAY_MS = 1000 * 60 * 60 * 24;
const daysAgo = (date: Date | null) => (date ? Math.floor((Date.now() - date.getTime()) / DAY_MS) : null);

export type CachedResult<T> = T & { mocked: boolean; generatedAt: Date; fromCache: boolean };

// ---------- Lead Insights (summary + advisory priority + next-action suggestion) ----------

export async function getLeadInsights(leadId: string, force = false): Promise<CachedResult<LeadInsights>> {
  const session = await requireSession();
  const lead = await getLeadDetail(leadId, session.companyId);
  if (!lead) throw new ForbiddenError();

  const sourceVersion = [
    lead.updatedAt.getTime(),
    lead.activities.length,
    lead.activities[0]?.createdAt.getTime() ?? 0,
    lead.quotations.length,
    lead.quotations[0]?.updatedAt.getTime() ?? 0,
  ].join(":");

  if (!force) {
    const cached = await getCachedInsight(session.companyId, "LEAD_INSIGHTS", "Lead", leadId);
    if (cached && cached.sourceVersion === sourceVersion) {
      return { ...(JSON.parse(cached.content) as LeadInsights), mocked: cached.mocked, generatedAt: cached.updatedAt, fromCache: true };
    }
  }

  const customerWonCount = await prisma.lead.count({ where: { customerId: lead.customerId, status: "WON" } });

  const now = new Date();
  const input: LeadInsightInput = {
    title: lead.title,
    product: lead.product,
    quantity: lead.quantity,
    estimatedValue: lead.estimatedValue,
    status: lead.status,
    priority: lead.priority,
    source: lead.source,
    customerName: lead.customer.name,
    customerCity: lead.customer.city,
    daysSinceCreated: daysAgo(lead.createdAt) ?? 0,
    nextAction: lead.nextAction,
    nextActionDeadline: lead.nextActionDeadline ? lead.nextActionDeadline.toISOString().slice(0, 10) : null,
    isOverdue: lead.risk.isOverdue,
    isUntouched: lead.risk.isUntouched,
    missingOwner: lead.risk.missingOwner,
    recentNotes: lead.activities.slice(0, 3).map((a) => a.notes).filter((n): n is string => !!n),
    quotations: lead.quotations.slice(0, 3).map((q) => ({
      status: q.status,
      value: q.value,
      daysSinceSent: daysAgo(q.sentAt),
      followUpOverdue: !!(q.followUpDate && q.followUpDate < now && q.status !== "ACCEPTED" && q.status !== "REJECTED"),
    })),
    customerWonCount,
    // Intentionally not computed here (would need a heavier repeat-order-signal
    // query) — Customer Summary is where that concern belongs; keeps this
    // feature's prompt/query footprint proportionate to "one lead."
    customerRepeatSignal: null,
  };

  const result = await generateLeadInsights(session.companyId, input);
  if (!result.ok) throw new Error(result.error);

  const saved = await upsertInsight({
    companyId: session.companyId,
    kind: "LEAD_INSIGHTS",
    entityType: "Lead",
    entityId: leadId,
    content: JSON.stringify(result.data),
    sourceVersion,
    mocked: result.mocked,
    provider: result.mocked ? "mock" : "anthropic",
  });

  revalidatePath(`/leads/${leadId}`);
  return { ...result.data, mocked: result.mocked, generatedAt: saved.updatedAt, fromCache: false };
}

/** The one place an AI suggestion is allowed to become a real change — and only via the existing scheduleFollowUp action, only after a human clicks Approve. */
export async function approveNextActionSuggestion(leadId: string, actingUserId: string | null): Promise<void> {
  const session = await requireSession();
  const lead = await prisma.lead.findFirst({ where: { id: leadId, companyId: session.companyId } });
  if (!lead) throw new ForbiddenError();

  const cached = await getCachedInsight(session.companyId, "LEAD_INSIGHTS", "Lead", leadId);
  if (!cached) throw new Error("No AI suggestion to approve — generate insights first.");

  const insights = JSON.parse(cached.content) as LeadInsights;
  const dueDate = new Date(Date.now() + Math.max(1, insights.suggestedDeadlineDays || 3) * DAY_MS);

  await scheduleFollowUp(leadId, insights.nextActionSuggestion, dueDate.toISOString(), lead.ownerId, actingUserId);
}

// ---------- Customer Summary ----------

export async function getCustomerInsights(customerId: string, force = false): Promise<CachedResult<CustomerSummaryResult>> {
  const session = await requireSession();
  const customer = await getCustomerDetail(customerId, session.companyId);
  if (!customer) throw new ForbiddenError();

  const sourceVersion = [
    customer.updatedAt.getTime(),
    customer.leads.length,
    customer.timeline[0]?.date.getTime() ?? 0,
  ].join(":");

  if (!force) {
    const cached = await getCachedInsight(session.companyId, "CUSTOMER_SUMMARY", "Customer", customerId);
    if (cached && cached.sourceVersion === sourceVersion) {
      return { ...(JSON.parse(cached.content) as CustomerSummaryResult), mocked: cached.mocked, generatedAt: cached.updatedAt, fromCache: true };
    }
  }

  const openOpportunities = customer.leads
    .filter((l) => l.status !== "WON" && l.status !== "LOST")
    .slice(0, 5)
    .map((l) => ({
      title: l.title,
      status: l.status,
      value: l.estimatedValue,
      isOverdue: !!(l.nextActionDeadline && l.nextActionDeadline < new Date()),
    }));

  const input: CustomerSummaryInput = {
    name: customer.name,
    city: customer.city,
    status: customer.customerStatus,
    totalWonValue: customer.totalWonValue,
    totalLostValue: customer.totalLostValue,
    totalEnquiries: customer.totalEnquiries,
    totalQuotations: customer.totalQuotations,
    productsRequested: customer.productsRequested,
    repeatOrderSignal: customer.repeatOrderSignal.status,
    repeatOrderEligible: customer.repeatOrderSignal.eligible,
    lastOrderDaysAgo: daysAgo(customer.lastWonDate),
    lastActivityDaysAgo: daysAgo(customer.lastActivityDate),
    openOpportunities,
  };

  const result = await generateCustomerSummary(session.companyId, input);
  if (!result.ok) throw new Error(result.error);

  const saved = await upsertInsight({
    companyId: session.companyId,
    kind: "CUSTOMER_SUMMARY",
    entityType: "Customer",
    entityId: customerId,
    content: JSON.stringify(result.data),
    sourceVersion,
    mocked: result.mocked,
    provider: result.mocked ? "mock" : "anthropic",
  });

  revalidatePath(`/customers/${customerId}`);
  return { ...result.data, mocked: result.mocked, generatedAt: saved.updatedAt, fromCache: false };
}

// ---------- Dashboard Sales Brief ----------

export async function getSalesBrief(force = false): Promise<CachedResult<SalesBriefResult>> {
  const session = await requireSession();
  const dashboard = await getDashboardData(session.companyId, session.userId);

  const topAttentionItems = dashboard.attentionItems.slice(0, 5);
  const sourceVersion = [
    dashboard.moneyAtRisk.totalAtRiskValue,
    topAttentionItems.length,
    topAttentionItems[0]?.id ?? "",
    topAttentionItems[0]?.amount ?? 0,
    dashboard.repeatOpportunities.length,
  ].join(":");

  const entityId = session.companyId;
  if (!force) {
    const cached = await getCachedInsight(session.companyId, "SALES_BRIEF", "Company", entityId);
    if (cached && cached.sourceVersion === sourceVersion) {
      return { ...(JSON.parse(cached.content) as SalesBriefResult), mocked: cached.mocked, generatedAt: cached.updatedAt, fromCache: true };
    }
  }

  const input: SalesBriefInput = {
    totalAtRiskValue: dashboard.moneyAtRisk.totalAtRiskValue,
    overdueQuotationCount: dashboard.moneyAtRisk.overdueQuotationCount,
    overdueQuotationValue: dashboard.moneyAtRisk.overdueQuotationValue,
    uncontactedLeadCount: dashboard.moneyAtRisk.uncontactedLeadCount,
    uncontactedLeadValue: dashboard.moneyAtRisk.uncontactedLeadValue,
    missingNextActionCount: dashboard.moneyAtRisk.missingNextActionCount,
    topAttentionItems: topAttentionItems.map((i) => ({
      title: i.title,
      subtitle: i.subtitle,
      amount: i.amount,
      urgencyLabel: i.urgencyLabel,
      severity: i.severity,
    })),
    topRepeatOpportunities: dashboard.repeatOpportunities.slice(0, 3).map((r) => ({
      customerName: r.customerName,
      status: r.status,
      estimatedValue: r.estimatedValue,
    })),
  };

  const result = await generateSalesBrief(session.companyId, input);
  if (!result.ok) throw new Error(result.error);

  const saved = await upsertInsight({
    companyId: session.companyId,
    kind: "SALES_BRIEF",
    entityType: "Company",
    entityId,
    content: JSON.stringify(result.data),
    sourceVersion,
    mocked: result.mocked,
    provider: result.mocked ? "mock" : "anthropic",
  });

  revalidatePath("/");
  return { ...result.data, mocked: result.mocked, generatedAt: saved.updatedAt, fromCache: false };
}

// ---------- Enquiry Extraction (no caching — one-off, ephemeral preview) ----------

export type ExtractionOutcome = { ok: true; data: ExtractedEnquiry; mocked: boolean } | { ok: false; error: string };

export async function extractEnquiryFromText(text: string): Promise<ExtractionOutcome> {
  const session = await requireSession();
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Paste some enquiry text first." };
  if (trimmed.length > 4000) return { ok: false, error: "That text is too long — please shorten it." };

  const result = await extractEnquiry(session.companyId, { text: trimmed });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data, mocked: result.mocked };
}
