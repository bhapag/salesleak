import { getLeadsForCompany } from "@/server/data/leads";
import { getQuotationsForCompany } from "@/server/data/quotations";
import { getCustomersForCompany } from "@/server/data/customers";
import { getFailedIngestions } from "@/server/data/ingestion";
import { normalizePhone, normalizeEmail } from "@/lib/contactMatch";

/**
 * Sales-data/workflow health (Phase 10) — not a server/infra health page.
 * Every check reuses the same tenant-scoped data functions and risk logic
 * already used elsewhere (leads.ts/quotations.ts/customers.ts), so this page
 * can never disagree with what the Leads/Quotations/Customers pages show.
 */

export type HealthIssueItem = { id: string; title: string; href: string; detail?: string };

export type HealthCategory = {
  key: string;
  label: string;
  description: string;
  count: number;
  items: HealthIssueItem[];
};

export type SalesHealthReport = { categories: HealthCategory[]; totalIssues: number };

const PREVIEW_LIMIT = 8;

export async function getSalesHealthReport(companyId: string): Promise<SalesHealthReport> {
  const [leads, quotations, customers, failedIngestions] = await Promise.all([
    getLeadsForCompany(companyId),
    getQuotationsForCompany(companyId),
    getCustomersForCompany(companyId),
    getFailedIngestions(companyId),
  ]);

  const activeLeads = leads.filter((l) => l.risk.isActive);
  const unassignedLeads = activeLeads.filter((l) => l.risk.missingOwner);
  const noNextAction = activeLeads.filter((l) => l.risk.missingNextAction);
  const noDeadline = activeLeads.filter((l) => l.risk.missingDeadline);

  const quotationsNoFollowUp = quotations.filter((q) => q.risk.isOpen && q.status !== "DRAFT" && !q.followUpDate);

  const incompleteCustomers = customers.filter((c) => !c.phone && !c.email);

  // Duplicate-risk: customers in the same company sharing a normalized phone or email.
  const groups = new Map<string, typeof customers>();
  for (const c of customers) {
    for (const key of [normalizePhone(c.phone) && `p:${normalizePhone(c.phone)}`, normalizeEmail(c.email) && `e:${normalizeEmail(c.email)}`]) {
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
  }
  const duplicateCustomerIds = new Set([...groups.values()].filter((g) => g.length > 1).flatMap((g) => g.map((c) => c.id)));
  const duplicateCustomers = customers.filter((c) => duplicateCustomerIds.has(c.id));

  const categories: HealthCategory[] = [
    {
      key: "unassigned-leads",
      label: "Unassigned leads",
      description: "Active leads with no salesperson assigned — nobody owns following up on these.",
      count: unassignedLeads.length,
      items: unassignedLeads.slice(0, PREVIEW_LIMIT).map((l) => ({ id: l.id, title: l.title, href: `/leads/${l.id}` })),
    },
    {
      key: "leads-no-next-action",
      label: "Leads without a next action",
      description: "Active leads with nothing scheduled — they'll quietly go stale unless someone acts.",
      count: noNextAction.length,
      items: noNextAction.slice(0, PREVIEW_LIMIT).map((l) => ({ id: l.id, title: l.title, href: `/leads/${l.id}` })),
    },
    {
      key: "leads-no-deadline",
      label: "Leads without a deadline",
      description: "Active leads with no due date to hold the next action to.",
      count: noDeadline.length,
      items: noDeadline.slice(0, PREVIEW_LIMIT).map((l) => ({ id: l.id, title: l.title, href: `/leads/${l.id}` })),
    },
    {
      key: "quotations-no-followup",
      label: "Quotations without a follow-up scheduled",
      description: "Sent quotations with no follow-up date set — easy to lose track of.",
      count: quotationsNoFollowUp.length,
      items: quotationsNoFollowUp.slice(0, PREVIEW_LIMIT).map((q) => ({ id: q.id, title: q.quotationNumber, href: `/quotations/${q.id}` })),
    },
    {
      key: "customers-incomplete-contact",
      label: "Customers with incomplete contact info",
      description: "No phone and no email on file — hard to reach if a deal needs attention.",
      count: incompleteCustomers.length,
      items: incompleteCustomers.slice(0, PREVIEW_LIMIT).map((c) => ({ id: c.id, title: c.name, href: `/customers/${c.id}` })),
    },
    {
      key: "duplicate-risk-customers",
      label: "Possible duplicate customer records",
      description: "Customers sharing the same phone number or email — may be the same business entered twice.",
      count: duplicateCustomers.length,
      items: duplicateCustomers.slice(0, PREVIEW_LIMIT).map((c) => ({ id: c.id, title: c.name, href: `/customers/${c.id}` })),
    },
    {
      key: "failed-ingestions",
      label: "Failed ingestions",
      description: "Incoming enquiries that couldn't be turned into leads automatically and need review.",
      count: failedIngestions.length,
      items: failedIngestions
        .slice(0, PREVIEW_LIMIT)
        .map((f) => ({ id: f.id, title: `${f.provider} enquiry`, detail: f.errorMessage, href: `/settings/integrations` })),
    },
  ];

  return { categories, totalIssues: categories.reduce((sum, c) => sum + c.count, 0) };
}
