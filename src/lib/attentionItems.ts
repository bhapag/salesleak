import type { LeadWithRisk } from "@/server/data/leads";
import type { QuotationWithRisk } from "@/server/data/quotations";
import type { CustomerSummary } from "@/server/data/customers";

/**
 * Builds a single "needs attention" row from a lead/quotation/customer. Pure
 * and DB-free so it can be shared by the dashboard's Attention Required feed
 * and the per-salesperson Needs Attention section without either re-deriving
 * urgency labels independently.
 */

export type AttentionItem = {
  id: string;
  kind: "lead" | "quotation" | "customer";
  href: string;
  title: string;
  subtitle: string;
  amount: number | null;
  urgencyLabel: string;
  severity: "critical" | "warning";
};

function formatDuration(from: Date, to: Date): string {
  const ms = to.getTime() - from.getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "less than an hour";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function buildLeadAttentionItem(lead: LeadWithRisk, now: Date): AttentionItem | null {
  if (!lead.risk.needsAttention) return null;

  let urgencyLabel: string;
  if (lead.risk.isOverdue && lead.nextActionDeadline) {
    const days = Math.floor((now.getTime() - lead.nextActionDeadline.getTime()) / (1000 * 60 * 60 * 24));
    urgencyLabel = days < 1 ? "Overdue today" : `Overdue by ${days} day${days === 1 ? "" : "s"}`;
  } else if (lead.risk.isUntouched) {
    urgencyLabel = `Untouched for ${formatDuration(lead.createdAt, now)}`;
  } else if (lead.risk.missingNextAction || lead.risk.missingDeadline) {
    urgencyLabel = "No next action set";
  } else {
    urgencyLabel = "Unassigned";
  }

  return {
    id: lead.id,
    kind: "lead",
    href: `/leads/${lead.id}`,
    title: lead.title,
    subtitle: `${lead.customer.name} · ${lead.owner ? lead.owner.name : "Unassigned"}`,
    amount: lead.estimatedValue,
    urgencyLabel,
    severity: lead.risk.isHighRiskOpportunity || lead.risk.isOverdue ? "critical" : "warning",
  };
}

export function buildQuotationAttentionItem(quotation: QuotationWithRisk, now: Date): AttentionItem | null {
  if (!quotation.risk.needsAttention) return null;

  let urgencyLabel: string;
  if (quotation.risk.isOverdueFollowUp && quotation.followUpDate) {
    const days = Math.floor((now.getTime() - quotation.followUpDate.getTime()) / (1000 * 60 * 60 * 24));
    urgencyLabel = days < 1 ? "Overdue today" : `Overdue by ${days} day${days === 1 ? "" : "s"}`;
  } else if (quotation.risk.isStale) {
    urgencyLabel = `No activity in ${Math.floor((now.getTime() - quotation.updatedAt.getTime()) / (1000 * 60 * 60 * 24))} days`;
  } else {
    urgencyLabel = "No next action set";
  }

  return {
    id: quotation.id,
    kind: "quotation",
    href: `/quotations/${quotation.id}`,
    title: `${quotation.quotationNumber} — ${quotation.lead.customer.name}`,
    subtitle: `${quotation.lead.title} · ${quotation.lead.owner ? quotation.lead.owner.name : "Unassigned"}`,
    amount: quotation.value,
    urgencyLabel,
    severity: quotation.risk.isHighRiskOpportunity || quotation.risk.isOverdueFollowUp ? "critical" : "warning",
  };
}

export function buildCustomerAttentionItem(customer: CustomerSummary): AttentionItem | null {
  // Only the two most actionable customer signals surface in unified feeds —
  // the rest (repeat-order Due Soon, multiple lost, etc.) live on the
  // Customers page and detail view so these feeds stay focused.
  const critical = customer.signals.find((s) => s.key === "repeat-overdue" || s.key === "high-value-inactive");
  if (!critical) return null;

  return {
    id: customer.id,
    kind: "customer",
    href: `/customers/${customer.id}`,
    title: customer.name,
    subtitle: customer.assignedSalesperson ? customer.assignedSalesperson.name : "Unassigned",
    amount: customer.totalWonValue || null,
    urgencyLabel: critical.label,
    severity: "critical",
  };
}
