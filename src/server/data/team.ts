import { prisma } from "@/lib/prisma";
import { getLeadsForCompany } from "./leads";
import { getQuotationsForCompany } from "./quotations";
import { getWorkQueueForCompany } from "./tasks";
import { getTaskRisk } from "@/lib/taskRisk";
import { startOfDayInTimezone } from "@/lib/timezone";
import { buildLeadAttentionItem, buildQuotationAttentionItem, type AttentionItem } from "@/lib/attentionItems";
import { getWonValueForLead, groupQuotationsByLead } from "@/lib/wonValue";
import { getCompanyRuntimeSettings } from "@/server/data/companySettings";

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export type TeamOverviewRow = {
  userId: string;
  name: string;
  role: string;
  isActive: boolean;
  activeLeads: number;
  newLeads: number;
  followUpsDueToday: number;
  overdueFollowUps: number;
  openQuotationValue: number;
  quotationValueAtRisk: number;
  wonValue: number;
  wonDeals: number;
  leadsMissingNextAction: number;
  upcomingTasks: number;
};

/**
 * One row per salesperson for the /team page and the dashboard's Team
 * Snapshot — the single source of truth for team-level numbers so neither
 * place recomputes this independently.
 */
export async function getTeamOverview(companyId: string): Promise<TeamOverviewRow[]> {
  const now = new Date();

  const [users, leads, quotations, tasks, settings] = await Promise.all([
    prisma.user.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    getLeadsForCompany(companyId),
    getQuotationsForCompany(companyId),
    prisma.task.findMany({ where: { lead: { companyId }, status: "PENDING" } }),
    getCompanyRuntimeSettings(companyId),
  ]);

  const todayStart = startOfDayInTimezone(now, settings.timezone);
  const tasksWithRisk = tasks.map((t) => ({ ...t, risk: getTaskRisk(t, now, todayStart) }));
  const quotationsByLead = groupQuotationsByLead(quotations);

  return users.map((u) => {
    const userLeads = leads.filter((l) => l.ownerId === u.id);
    const userLeadIds = new Set(userLeads.map((l) => l.id));
    const userQuotations = quotations.filter((q) => userLeadIds.has(q.leadId));
    const userTasks = tasksWithRisk.filter((t) => t.assignedToId === u.id);

    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      activeLeads: userLeads.filter((l) => l.risk.isActive).length,
      newLeads: userLeads.filter((l) => l.status === "NEW").length,
      followUpsDueToday: userTasks.filter((t) => t.risk.bucket === "due_today").length,
      overdueFollowUps: userTasks.filter((t) => t.risk.bucket === "overdue").length,
      openQuotationValue: sum(userQuotations.filter((q) => q.risk.isOpen).map((q) => q.value)),
      quotationValueAtRisk: sum(userQuotations.filter((q) => q.risk.needsAttention).map((q) => q.value)),
      wonValue: sum(userLeads.filter((l) => l.status === "WON").map((l) => getWonValueForLead(l, quotationsByLead.get(l.id) ?? []))),
      wonDeals: userLeads.filter((l) => l.status === "WON").length,
      leadsMissingNextAction: userLeads.filter((l) => l.risk.isActive && (l.risk.missingNextAction || l.risk.missingDeadline)).length,
      upcomingTasks: userTasks.filter((t) => t.risk.bucket === "upcoming").length,
    };
  });
}

export async function getSalespersonDetail(companyId: string, userId: string) {
  const now = new Date();
  const [user, leads, quotations, workQueue, recentActivities] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getLeadsForCompany(companyId),
    getQuotationsForCompany(companyId),
    getWorkQueueForCompany(companyId, { userId }),
    prisma.activity.findMany({
      where: { lead: { companyId }, userId },
      include: { lead: { include: { customer: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  if (!user || user.companyId !== companyId) return null;

  const userLeads = leads.filter((l) => l.ownerId === userId);
  const userQuotations = quotations.filter((q) => q.lead.ownerId === userId);

  const needsAttentionLeads = userLeads.filter((l) => l.risk.needsAttention);
  const needsAttentionQuotations = userQuotations.filter((q) => q.risk.needsAttention);
  const moneyAtRisk = sum(needsAttentionLeads.map((l) => l.estimatedValue ?? 0)) + sum(needsAttentionQuotations.map((q) => q.value));

  const needsAttention = [
    ...needsAttentionLeads.map((l) => buildLeadAttentionItem(l, now)),
    ...needsAttentionQuotations.map((q) => buildQuotationAttentionItem(q, now)),
  ]
    .filter((x): x is AttentionItem => x != null)
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
      return (b.amount ?? 0) - (a.amount ?? 0);
    });

  return {
    user,
    needsAttention,
    overdueLeads: userLeads.filter((l) => l.risk.isOverdue),
    activeLeads: userLeads.filter((l) => l.risk.isActive),
    wonOpportunities: userLeads.filter((l) => l.status === "WON"),
    openQuotations: userQuotations.filter((q) => q.risk.isOpen),
    overdueQuotations: userQuotations.filter((q) => q.risk.isOverdueFollowUp),
    today: workQueue.dueToday,
    overdueTasks: workQueue.overdue,
    upcoming: workQueue.upcoming,
    recentActivities,
    moneyAtRisk,
  };
}

export type SalespersonDetail = NonNullable<Awaited<ReturnType<typeof getSalespersonDetail>>>;
