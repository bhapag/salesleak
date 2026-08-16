import { prisma } from "@/lib/prisma";
import { getLeadRisk } from "@/lib/leadRisk";
import { getCompanyRiskThresholds } from "@/server/data/companySettings";

export async function getLeadsForCompany(companyId: string) {
  const [leads, thresholds] = await Promise.all([
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
    getCompanyRiskThresholds(companyId),
  ]);

  const now = new Date();
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
      thresholds.highValueThreshold
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

  const thresholds = await getCompanyRiskThresholds(companyId);
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
    new Date(),
    thresholds.highValueThreshold
  );

  return { ...lead, lastActivityAt, risk };
}

export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>>;
