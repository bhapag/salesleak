import { prisma } from "@/lib/prisma";
import { getTaskRisk } from "@/lib/taskRisk";

const OPEN_QUOTATION_STATUSES = ["DRAFT", "SENT", "FOLLOWED_UP"] as const;

export async function getWorkQueueForCompany(companyId: string, opts?: { userId?: string }) {
  const tasks = await prisma.task.findMany({
    where: {
      lead: { companyId },
      ...(opts?.userId ? { assignedToId: opts.userId } : {}),
    },
    include: {
      lead: {
        include: {
          customer: true,
          owner: true,
          quotations: { where: { status: { in: [...OPEN_QUOTATION_STATUSES] } }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      assignedTo: true,
    },
    orderBy: { dueDate: "asc" },
  });

  const now = new Date();
  const enriched = tasks.map((task) => ({ ...task, risk: getTaskRisk(task, now) }));

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
