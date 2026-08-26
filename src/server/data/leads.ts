import { prisma } from "@/lib/prisma";
import { getLeadRisk } from "@/lib/leadRisk";
import { getCompanyRuntimeSettings } from "@/server/data/companySettings";
import { startOfDayInTimezone } from "@/lib/timezone";

export async function getLeadsForCompany(companyId: string) {
  const [leads, settings] = await Promise.all([
    prisma.lead.findMany({
      where: { companyId },
      include: {
        customer: true,
        owner: true,
        quotations: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    getCompanyRuntimeSettings(companyId),
  ]);

  const now = new Date();
  // Computed once per request and reused for every lead below — "overdue"
  // respects the company's own timezone, not server-local/UTC.
  const todayStart = startOfDayInTimezone(now, settings.timezone);

  return leads.map((lead) => {
    const lastActivityAt = lead.activities[0]?.createdAt ?? null;
    const risk = getLeadRisk(
      {
        status: lead.status,
        ownerId: lead.ownerId,
        nextAction: lead.nextAction,
        nextActionDeadline: lead.nextActionDeadline,
        priority: lead.priority,
        estimatedValue: lead.estimatedValue,
        lastActivityAt,
      },
      now,
      settings.highValueThreshold,
      todayStart
    );
    return { ...lead, lastActivityAt, risk };
  });
}

export type LeadWithRisk = Awaited<ReturnType<typeof getLeadsForCompany>>[number];

export async function getLeadDetail(leadId: string, companyId: string) {
  // findFirst (not findUnique) so companyId can be enforced as part of the
  // query itself — a cross-tenant id can never even reach the "is it null"
  // check, let alone a later comparison that could be skipped by mistake.
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId },
    include: {
      customer: true,
      owner: true,
      company: true,
      quotations: { include: { items: true }, orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { dueDate: "asc" } },
      activities: { include: { user: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!lead) return null;

  const settings = await getCompanyRuntimeSettings(companyId);
  const lastActivityAt = lead.activities[0]?.createdAt ?? null;
  const now = new Date();
  const todayStart = startOfDayInTimezone(now, lead.company.timezone);
  const risk = getLeadRisk(
    {
      status: lead.status,
      ownerId: lead.ownerId,
      nextAction: lead.nextAction,
      nextActionDeadline: lead.nextActionDeadline,
      priority: lead.priority,
      estimatedValue: lead.estimatedValue,
      lastActivityAt,
    },
    now,
    settings.highValueThreshold,
    todayStart
  );

  // Exposed so embedded client components (FollowUpsCard) can classify this
  // lead's tasks against the same company-timezone-aware boundary already
  // computed here for the lead's own risk — instead of each defaulting to
  // its own render-time instant and drifting out of sync with it.
  return { ...lead, lastActivityAt, risk, todayStart };
}

export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>>;
