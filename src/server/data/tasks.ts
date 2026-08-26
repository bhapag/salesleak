import { prisma } from "@/lib/prisma";
import { getTaskRisk } from "@/lib/taskRisk";
import { startOfDayInTimezone } from "@/lib/timezone";
import { getCompanyRuntimeSettings } from "@/server/data/companySettings";

const OPEN_QUOTATION_STATUSES = ["DRAFT", "SENT", "FOLLOWED_UP"] as const;

export async function getWorkQueueForCompany(companyId: string, opts?: { userId?: string }) {
  // Fetched as one shallow level (task + its direct lead + assignedTo) rather
  // than a 4-level-deep `include` chain. Prisma resolves multi-level nested
  // includes as one SQL statement per relation, run sequentially — fine on a
  // fast local DB, but each one is a full network round trip, and this app's
  // database is cross-region from where it's deployed. The lead's own
  // customer/owner/open-quotation are fetched as three independent queries
  // below, run concurrently, and stitched back on — same data, roughly half
  // the number of sequential round trips.
  const [tasks, settings] = await Promise.all([
    prisma.task.findMany({
      where: {
        lead: { companyId },
        ...(opts?.userId ? { assignedToId: opts.userId } : {}),
      },
      include: { lead: true, assignedTo: true },
      orderBy: { dueDate: "asc" },
    }),
    getCompanyRuntimeSettings(companyId),
  ]);

  const customerIds = [...new Set(tasks.map((t) => t.lead.customerId))];
  const ownerIds = [...new Set(tasks.map((t) => t.lead.ownerId).filter((id) => id !== null))];
  const leadIds = [...new Set(tasks.map((t) => t.lead.id))];

  const [customers, owners, openQuotations] = await Promise.all([
    prisma.customer.findMany({ where: { id: { in: customerIds } } }),
    prisma.user.findMany({ where: { id: { in: ownerIds } } }),
    prisma.quotation.findMany({
      where: { leadId: { in: leadIds }, status: { in: [...OPEN_QUOTATION_STATUSES] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const customerById = new Map(customers.map((c) => [c.id, c]));
  const ownerById = new Map(owners.map((u) => [u.id, u]));
  const openQuotationByLeadId = new Map<string, (typeof openQuotations)[number]>();
  for (const q of openQuotations) {
    if (!openQuotationByLeadId.has(q.leadId)) openQuotationByLeadId.set(q.leadId, q);
  }

  const tasksWithLeadData = tasks.map((task) => {
    const openQuotation = openQuotationByLeadId.get(task.lead.id);
    return {
      ...task,
      lead: {
        ...task.lead,
        customer: customerById.get(task.lead.customerId)!,
        owner: task.lead.ownerId ? (ownerById.get(task.lead.ownerId) ?? null) : null,
        quotations: openQuotation ? [openQuotation] : [],
      },
    };
  });

  const now = new Date();
  // Computed once per request and reused for every task below — "overdue" /
  // "due today" respect the company's own timezone, not server-local/UTC.
  const todayStart = startOfDayInTimezone(now, settings.timezone);
  const enriched = tasksWithLeadData.map((task) => ({ ...task, risk: getTaskRisk(task, now, todayStart) }));

  return {
    overdue: enriched.filter((t) => t.risk.bucket === "overdue").sort((a, b) => b.risk.daysOverdue - a.risk.daysOverdue),
    dueToday: enriched.filter((t) => t.risk.bucket === "due_today"),
    upcoming: enriched.filter((t) => t.risk.bucket === "upcoming").sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    completed: enriched
      .filter((t) => t.risk.bucket === "completed")
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
      .slice(0, 20),
  };
}

export type WorkQueue = Awaited<ReturnType<typeof getWorkQueueForCompany>>;
export type WorkQueueTask = WorkQueue["overdue"][number];
