import { prisma } from "@/lib/prisma";
import { getLeadRisk } from "@/lib/leadRisk";
import { getQuotationRisk } from "@/lib/quotationRisk";
import { computeCustomerStatus, computeRepeatOrderSignal, computeCustomerSignals } from "@/lib/customerIntelligence";
import { formatCurrency, formatSource, labelize } from "@/lib/format";
import { getCompanyRiskThresholds, type CompanyRiskThresholds } from "@/server/data/companySettings";
import type { LeadStatus, LeadPriority, QuotationStatus } from "@/generated/prisma/client";

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function maxDate(dates: Date[]): Date | null {
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

type LeadForMetrics = {
  id: string;
  status: LeadStatus;
  priority: LeadPriority;
  estimatedValue: number | null;
  wonAt: Date | null;
  lostAt: Date | null;
  createdAt: Date;
  ownerId: string | null;
  owner: { id: string; name: string } | null;
  nextAction: string | null;
  nextActionDeadline: Date | null;
  product: string | null;
  quotations: {
    id: string;
    status: QuotationStatus;
    value: number;
    sentAt: Date | null;
    followUpDate: Date | null;
    nextAction: string | null;
    updatedAt: Date;
  }[];
  activities: { createdAt: Date }[];
};

function computeCustomerMetrics(leads: LeadForMetrics[], now: Date, thresholds: CompanyRiskThresholds) {
  const allQuotations = leads.flatMap((l) => l.quotations);

  const wonLeads = leads.filter((l) => l.status === "WON");
  const lostLeads = leads.filter((l) => l.status === "LOST");
  const activeLeads = leads.filter((l) => l.status !== "WON" && l.status !== "LOST");

  const totalWonValue = sum(wonLeads.map((l) => l.estimatedValue ?? 0));
  const totalLostValue = sum(lostLeads.map((l) => l.estimatedValue ?? 0));
  const totalQuotationValue = sum(allQuotations.map((q) => q.value));
  const totalOpportunityValue = sum(leads.map((l) => l.estimatedValue ?? 0));

  const lastEnquiryDate = maxDate(leads.map((l) => l.createdAt));
  const lastWonDate = maxDate(wonLeads.map((l) => l.wonAt).filter((d): d is Date => d != null));

  const activityDates = leads.flatMap((l) => l.activities.map((a) => a.createdAt));
  const lastActivityDate = maxDate([...activityDates, ...leads.map((l) => l.createdAt)]);

  // Queries order leads desc by createdAt, so the first is the most recent enquiry.
  const mostRecentLead = leads[0] ?? null;
  const assignedSalesperson = mostRecentLead?.owner ? { id: mostRecentLead.owner.id, name: mostRecentLead.owner.name } : null;

  const hasActiveLead = activeLeads.length > 0;

  const repeatOrderSignal = computeRepeatOrderSignal(
    wonLeads.filter((l): l is LeadForMetrics & { wonAt: Date } => l.wonAt != null).map((l) => ({ wonAt: l.wonAt, value: l.estimatedValue ?? 0 })),
    now
  );

  const customerStatus = computeCustomerStatus(
    { hasActiveLead, wonCount: wonLeads.length, lostCount: lostLeads.length, totalLeads: leads.length, lastTouchedAt: lastActivityDate },
    now
  );

  const activeLeadRisks = activeLeads.map((l) =>
    getLeadRisk(
      {
        status: l.status,
        ownerId: l.ownerId,
        nextAction: l.nextAction,
        nextActionDeadline: l.nextActionDeadline,
        priority: l.priority,
        estimatedValue: l.estimatedValue,
        lastActivityAt: l.activities[0]?.createdAt ?? null,
      },
      now,
      thresholds.highValueThreshold
    )
  );
  const hasActiveLeadMissingNextAction = activeLeadRisks.some((r) => r.missingNextAction || r.missingDeadline);
  const hasOverdueFollowUpLead = activeLeadRisks.some((r) => r.isOverdue);

  const quotationRisks = allQuotations.map((q) =>
    getQuotationRisk(
      { status: q.status, value: q.value, sentAt: q.sentAt, followUpDate: q.followUpDate, nextAction: q.nextAction, updatedAt: q.updatedAt },
      now,
      { highValueThreshold: thresholds.highValueThreshold, staleDaysThreshold: thresholds.staleQuotationDays }
    )
  );
  const hasOverdueFollowUpQuotation = quotationRisks.some((r) => r.isOverdueFollowUp);
  const hasOpenQuotationAtRisk = quotationRisks.some((r) => r.needsAttention);

  const signals = computeCustomerSignals({
    customerStatus,
    repeatOrderSignal,
    totalWonValue,
    hasOpenQuotationAtRisk,
    hasOverdueFollowUp: hasOverdueFollowUpLead || hasOverdueFollowUpQuotation,
    lostCount: lostLeads.length,
    hasActiveLeadMissingNextAction,
  });

  const productsRequested = [...new Set(leads.map((l) => l.product).filter((p): p is string => !!p))];

  const upcomingLead = [...activeLeads].sort((a, b) => {
    const at = a.nextActionDeadline?.getTime() ?? Infinity;
    const bt = b.nextActionDeadline?.getTime() ?? Infinity;
    return at - bt;
  })[0];

  return {
    totalEnquiries: leads.length,
    totalQuotations: allQuotations.length,
    totalWonValue,
    totalLostValue,
    totalQuotationValue,
    totalOpportunityValue,
    lastEnquiryDate,
    lastWonDate,
    lastActivityDate,
    assignedSalesperson,
    customerStatus,
    repeatOrderSignal,
    signals,
    productsRequested,
    upcomingNextAction: upcomingLead?.nextAction
      ? { text: upcomingLead.nextAction, deadline: upcomingLead.nextActionDeadline, leadId: upcomingLead.id }
      : null,
  };
}

export async function getCustomersForCompany(companyId: string) {
  const [customers, thresholds] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId },
      include: {
        leads: {
          include: {
            owner: true,
            quotations: true,
            activities: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    getCompanyRiskThresholds(companyId),
  ]);

  const now = new Date();
  return customers.map(({ leads, ...customer }) => ({ ...customer, ...computeCustomerMetrics(leads, now, thresholds) }));
}

export type CustomerSummary = Awaited<ReturnType<typeof getCustomersForCompany>>[number];

export type CustomerTimelineEntry = {
  id: string;
  date: Date;
  kind: "enquiry" | "quotation" | "won" | "lost" | "activity";
  title: string;
  subtitle: string | null;
  href: string;
};

function buildTimeline(
  leads: {
    id: string;
    title: string;
    source: string;
    status: LeadStatus;
    estimatedValue: number | null;
    createdAt: Date;
    wonAt: Date | null;
    lostAt: Date | null;
    lostReason: string | null;
    quotations: { id: string; quotationNumber: string; value: number; createdAt: Date }[];
    activities: { id: string; notes: string | null; type: string; createdAt: Date; user: { name: string } | null }[];
  }[]
): CustomerTimelineEntry[] {
  const entries: CustomerTimelineEntry[] = [];

  for (const lead of leads) {
    entries.push({
      id: `enquiry-${lead.id}`,
      date: lead.createdAt,
      kind: "enquiry",
      title: `New enquiry: ${lead.title}`,
      subtitle: `${formatSource(lead.source)}${lead.estimatedValue ? ` · ${formatCurrency(lead.estimatedValue)}` : ""}`,
      href: `/leads/${lead.id}`,
    });

    if (lead.status === "WON" && lead.wonAt) {
      entries.push({
        id: `won-${lead.id}`,
        date: lead.wonAt,
        kind: "won",
        title: `Won: ${lead.title}`,
        subtitle: formatCurrency(lead.estimatedValue),
        href: `/leads/${lead.id}`,
      });
    }
    if (lead.status === "LOST" && lead.lostAt) {
      entries.push({
        id: `lost-${lead.id}`,
        date: lead.lostAt,
        kind: "lost",
        title: `Lost: ${lead.title}`,
        subtitle: lead.lostReason,
        href: `/leads/${lead.id}`,
      });
    }

    for (const q of lead.quotations) {
      entries.push({
        id: `quotation-${q.id}`,
        date: q.createdAt,
        kind: "quotation",
        title: `Quotation ${q.quotationNumber} created`,
        subtitle: formatCurrency(q.value),
        href: `/quotations/${q.id}`,
      });
    }

    for (const activity of lead.activities) {
      entries.push({
        id: `activity-${activity.id}`,
        date: activity.createdAt,
        kind: "activity",
        title: activity.notes ?? labelize(activity.type),
        subtitle: `${labelize(activity.type)}${activity.user ? ` · ${activity.user.name}` : ""}`,
        href: `/leads/${lead.id}`,
      });
    }
  }

  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getCustomerDetail(customerId: string, companyId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    include: {
      leads: {
        include: {
          owner: true,
          quotations: { include: { items: true }, orderBy: { createdAt: "desc" } },
          activities: { include: { user: true }, orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) return null;

  const thresholds = await getCompanyRiskThresholds(companyId);
  const now = new Date();
  const { leads, ...customerFields } = customer;
  const metrics = computeCustomerMetrics(leads, now, thresholds);
  const timeline = buildTimeline(leads);

  return { ...customerFields, ...metrics, leads, timeline };
}

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomerDetail>>>;
