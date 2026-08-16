import { prisma } from "@/lib/prisma";
import { getLeadsForCompany } from "./leads";
import { getQuotationsForCompany } from "./quotations";
import { getCustomersForCompany } from "./customers";
import { getTeamOverview, type TeamOverviewRow } from "./team";
import { getNotificationsForUser } from "./notifications";
import { buildLeadAttentionItem, buildQuotationAttentionItem, buildCustomerAttentionItem, type AttentionItem } from "@/lib/attentionItems";

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export type DashboardStats = {
  newEnquiries: number;
  uncontactedEnquiries: number;
  followUpsDueToday: number;
  overdueFollowUps: number;
  openQuotationValue: number;
  quotationValueOverdue: number;
  opportunitiesWithoutNextAction: number;
  wonValue: number;
};

export type MoneyAtRisk = {
  overdueQuotationValue: number;
  overdueQuotationCount: number;
  uncontactedLeadValue: number;
  uncontactedLeadCount: number;
  missingNextActionValue: number;
  missingNextActionCount: number;
  staleQuotationValue: number;
  staleQuotationCount: number;
  totalAtRiskValue: number;
};

export type RepeatOpportunity = {
  customerId: string;
  customerName: string;
  status: "Due Soon" | "Repeat Order Due" | "Overdue / Dormant";
  estimatedValue: number | null;
  lastOrderDate: Date | null;
  assignedSalesperson: string | null;
  suggestedAction: string;
};

export type WorkToday = {
  todaysWorkCount: number;
  teamOverdueCount: number;
  unreadNotificationCount: number;
};

export type DashboardData = {
  stats: DashboardStats;
  moneyAtRisk: MoneyAtRisk;
  attentionItems: AttentionItem[];
  teamSnapshot: TeamOverviewRow[];
  repeatOpportunities: RepeatOpportunity[];
  workToday: WorkToday;
};

/**
 * ownerScope mirrors the same parameter used by /leads, /quotations, and
 * /customers (see getOwnerScope in permissions.ts): undefined for Owner/Sales
 * Manager (whole company), or a userId to restrict a Salesperson's dashboard
 * to their own leads/quotations/customers, consistent with every other list
 * page in the app. teamSnapshot (named peers' individual figures) is the one
 * piece of company-wide data /team itself restricts to Owner/Sales Manager,
 * so it's only fetched/returned when ownerScope is unset.
 */
export async function getDashboardData(companyId: string, userId: string, ownerScope?: string): Promise<DashboardData> {
  const now = new Date();
  const today = startOfDay(now);

  const [allLeads, allQuotations, allTasks, allCustomers, teamSnapshot, userNotifications] = await Promise.all([
    getLeadsForCompany(companyId),
    getQuotationsForCompany(companyId),
    prisma.task.findMany({ where: { status: "PENDING", lead: { companyId, ...(ownerScope ? { ownerId: ownerScope } : {}) } } }),
    getCustomersForCompany(companyId),
    ownerScope ? Promise.resolve([]) : getTeamOverview(companyId),
    getNotificationsForUser(companyId, userId),
  ]);

  const leads = ownerScope ? allLeads.filter((l) => l.ownerId === ownerScope) : allLeads;
  const quotations = ownerScope ? allQuotations.filter((q) => q.lead.ownerId === ownerScope) : allQuotations;
  const tasks = allTasks;
  const customers = ownerScope ? allCustomers.filter((c) => c.assignedSalesperson?.id === ownerScope) : allCustomers;

  const unreadNotificationCount = userNotifications.filter((n) => !n.isRead).length;

  const activeLeads = leads.filter((l) => l.risk.isActive);
  const uncontactedLeads = activeLeads.filter((l) => l.risk.isUntouched);
  const missingNextActionLeads = activeLeads.filter((l) => l.risk.missingNextAction || l.risk.missingDeadline);

  const followUpsDueToday = tasks.filter((t) => startOfDay(t.dueDate).getTime() === today.getTime()).length;
  const overdueFollowUps = tasks.filter((t) => t.dueDate < today).length;

  const openQuotations = quotations.filter((q) => q.risk.isOpen);
  const overdueQuotations = quotations.filter((q) => q.risk.isOverdueFollowUp);
  const staleQuotations = quotations.filter((q) => q.risk.isStale);

  const stats: DashboardStats = {
    newEnquiries: leads.filter((l) => l.status === "NEW").length,
    uncontactedEnquiries: uncontactedLeads.length,
    followUpsDueToday,
    overdueFollowUps,
    openQuotationValue: sum(openQuotations.map((q) => q.value)),
    quotationValueOverdue: sum(overdueQuotations.map((q) => q.value)),
    opportunitiesWithoutNextAction: missingNextActionLeads.length,
    wonValue: sum(leads.filter((l) => l.status === "WON").map((l) => l.estimatedValue ?? 0)),
  };

  const atRiskLeadIds = new Set([...uncontactedLeads, ...missingNextActionLeads].map((l) => l.id));
  const atRiskLeadValue = sum(leads.filter((l) => atRiskLeadIds.has(l.id)).map((l) => l.estimatedValue ?? 0));
  const atRiskQuotationIds = new Set([...overdueQuotations, ...staleQuotations].map((q) => q.id));
  const atRiskQuotationValue = sum(quotations.filter((q) => atRiskQuotationIds.has(q.id)).map((q) => q.value));

  const moneyAtRisk: MoneyAtRisk = {
    overdueQuotationValue: sum(overdueQuotations.map((q) => q.value)),
    overdueQuotationCount: overdueQuotations.length,
    uncontactedLeadValue: sum(uncontactedLeads.map((l) => l.estimatedValue ?? 0)),
    uncontactedLeadCount: uncontactedLeads.length,
    missingNextActionValue: sum(missingNextActionLeads.map((l) => l.estimatedValue ?? 0)),
    missingNextActionCount: missingNextActionLeads.length,
    staleQuotationValue: sum(staleQuotations.map((q) => q.value)),
    staleQuotationCount: staleQuotations.length,
    totalAtRiskValue: atRiskLeadValue + atRiskQuotationValue,
  };

  const attentionItems = [
    ...leads.map((l) => buildLeadAttentionItem(l, now)).filter((x): x is AttentionItem => x != null),
    ...quotations.map((q) => buildQuotationAttentionItem(q, now)).filter((x): x is AttentionItem => x != null),
    ...customers.map((c) => buildCustomerAttentionItem(c)).filter((x): x is AttentionItem => x != null),
  ].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return (b.amount ?? 0) - (a.amount ?? 0);
  });

  const repeatOpportunities: RepeatOpportunity[] = customers
    .filter(
      (c) =>
        c.repeatOrderSignal.eligible &&
        (c.repeatOrderSignal.status === "Due Soon" ||
          c.repeatOrderSignal.status === "Repeat Order Due" ||
          c.repeatOrderSignal.status === "Overdue / Dormant")
    )
    .map((c) => ({
      customerId: c.id,
      customerName: c.name,
      status: c.repeatOrderSignal.status as "Due Soon" | "Repeat Order Due" | "Overdue / Dormant",
      estimatedValue: c.repeatOrderSignal.estimatedOrderValue,
      lastOrderDate: c.repeatOrderSignal.lastOrderDate,
      assignedSalesperson: c.assignedSalesperson?.name ?? null,
      suggestedAction:
        c.repeatOrderSignal.status === "Overdue / Dormant"
          ? "Reach out — they're well past their usual reorder timing"
          : c.repeatOrderSignal.status === "Repeat Order Due"
            ? "Follow up about a repeat order"
            : "Check in soon — a reorder is likely coming up",
    }))
    .sort((a, b) => {
      const rank = { "Overdue / Dormant": 0, "Repeat Order Due": 1, "Due Soon": 2 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0);
    })
    .slice(0, 6);

  const workToday: WorkToday = {
    todaysWorkCount: followUpsDueToday,
    teamOverdueCount: overdueFollowUps,
    unreadNotificationCount,
  };

  return { stats, moneyAtRisk, attentionItems: attentionItems.slice(0, 10), teamSnapshot, repeatOpportunities, workToday };
}
