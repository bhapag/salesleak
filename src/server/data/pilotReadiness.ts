import { prisma } from "@/lib/prisma";
import { getLeadsForCompany } from "@/server/data/leads";
import { getWorkQueueForCompany } from "@/server/data/tasks";
import { getIntegrationsForCompany, getFailedIngestions } from "@/server/data/ingestion";

export type PilotReadinessCheck = {
  key: string;
  label: string;
  detail: string;
  ok: boolean;
  count?: number;
  href?: string;
};

export type PilotReadinessReport = {
  checks: PilotReadinessCheck[];
  openOpportunities: { count: number; value: number };
};

/**
 * A setup-completeness checklist for a real pilot company (Phase 13) —
 * distinct from /health's ongoing sales-data-quality monitoring. Reuses the
 * same tenant-scoped data functions everything else already calls; never
 * invents a second definition of "at risk" or "unassigned."
 */
export async function getPilotReadinessReport(companyId: string): Promise<PilotReadinessReport> {
  const [company, users, leads, workQueue, integrations, failedIngestions] = await Promise.all([
    prisma.company.findFirstOrThrow({ where: { id: companyId } }),
    prisma.user.findMany({ where: { companyId, isActive: true } }),
    getLeadsForCompany(companyId),
    getWorkQueueForCompany(companyId),
    getIntegrationsForCompany(companyId),
    getFailedIngestions(companyId),
  ]);

  const activeLeads = leads.filter((l) => l.risk.isActive);
  const unassignedLeads = activeLeads.filter((l) => l.risk.missingOwner);
  const salespeople = users.filter((u) => u.role !== "OWNER");
  const activeLeadSources = company.activeLeadSources ? (JSON.parse(company.activeLeadSources) as string[]) : [];
  const lostReasonPresets = company.lostReasonPresets ? (JSON.parse(company.lostReasonPresets) as string[]) : [];
  const setUpConnectors = integrations.filter((c) => c.functional && (c.webhookCapable ? !!c.webhookUrl : c.enabled));
  const overdueFollowUps = workQueue.overdue.length;
  const openOpportunities = { count: activeLeads.length, value: activeLeads.reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0) };

  const checks: PilotReadinessCheck[] = [
    {
      key: "team",
      label: "Sales team added",
      detail:
        salespeople.length > 0
          ? `${salespeople.length} ${salespeople.length === 1 ? "salesperson" : "salespeople"} added, beyond the Owner.`
          : "Only the Owner account exists — add at least one salesperson so leads have someone to work them.",
      ok: salespeople.length > 0,
      count: salespeople.length,
      href: "/team",
    },
    {
      key: "lead-sources",
      label: "Lead sources configured",
      detail:
        activeLeadSources.length > 0
          ? `${activeLeadSources.length} lead source${activeLeadSources.length === 1 ? "" : "s"} selected in Company Settings.`
          : "No lead sources selected yet — pick which channels this company actually uses.",
      ok: activeLeadSources.length > 0,
      count: activeLeadSources.length,
      href: "/settings/company",
    },
    {
      key: "workflow-settings",
      label: "Workflow settings customized",
      detail:
        lostReasonPresets.length > 0
          ? "Common lost reasons are configured."
          : "No lost-reason presets set — the Close Deal forms will only have free text.",
      ok: lostReasonPresets.length > 0,
      href: "/settings/company",
    },
    {
      key: "unassigned-leads",
      label: "No unassigned leads",
      detail:
        unassignedLeads.length > 0
          ? `${unassignedLeads.length} active lead${unassignedLeads.length === 1 ? "" : "s"} have no salesperson assigned.`
          : "Every active lead has an owner.",
      ok: unassignedLeads.length === 0,
      count: unassignedLeads.length,
      href: "/leads",
    },
    {
      key: "integrations",
      label: "At least one connector set up",
      detail:
        setUpConnectors.length > 0
          ? `${setUpConnectors.length} connector${setUpConnectors.length === 1 ? "" : "s"} live or configured (CSV/manual entry always count).`
          : "No lead-capture connector is set up yet.",
      ok: setUpConnectors.length > 0,
      count: setUpConnectors.length,
      href: "/settings/integrations",
    },
    {
      key: "failed-ingestions",
      label: "No failed ingestions waiting",
      detail:
        failedIngestions.length > 0
          ? `${failedIngestions.length} incoming enquir${failedIngestions.length === 1 ? "y" : "ies"} couldn't become a lead and need review.`
          : "Nothing stuck in the failed ingestion queue.",
      ok: failedIngestions.length === 0,
      count: failedIngestions.length,
      href: "/settings/integrations",
    },
    {
      key: "overdue-followups",
      label: "No overdue follow-ups",
      detail:
        overdueFollowUps > 0
          ? `${overdueFollowUps} follow-up${overdueFollowUps === 1 ? " is" : "s are"} overdue across the team.`
          : "Nothing overdue right now.",
      ok: overdueFollowUps === 0,
      count: overdueFollowUps,
      href: "/tasks",
    },
  ];

  return { checks, openOpportunities };
}
