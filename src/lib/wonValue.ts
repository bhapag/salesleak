import type { LeadStatus, QuotationStatus } from "@/generated/prisma/client";

/**
 * The value to credit a WON lead with, for Dashboard/team money figures.
 * Prefers the value of the lead's accepted (ACCEPTED-status) quotation — the
 * real agreed order value — over Lead.estimatedValue, which is often just a
 * pre-quotation guess and can be misleading once a real quotation exists.
 * Falls back to estimatedValue when no accepted quotation exists, since a
 * lead can be marked Won directly without ever going through a quotation
 * (see leads.ts markWon). If a lead somehow carries more than one ACCEPTED
 * quotation, only the most recently accepted one counts — never a sum — so
 * revenue is never double-counted.
 */
export function getWonValueForLead(
  lead: { status: LeadStatus; estimatedValue: number | null },
  quotationsForLead: { status: QuotationStatus; value: number; wonAt: Date | null }[]
): number {
  if (lead.status !== "WON") return 0;

  const accepted = quotationsForLead.filter((q) => q.status === "ACCEPTED");
  if (accepted.length === 0) return lead.estimatedValue ?? 0;

  const winning = accepted.reduce((latest, q) => ((q.wonAt?.getTime() ?? 0) >= (latest.wonAt?.getTime() ?? 0) ? q : latest));
  return winning.value;
}

/** Groups a company's quotations by leadId so per-lead Won Value lookups are O(1) instead of re-filtering the whole array per lead. */
export function groupQuotationsByLead<Q extends { leadId: string }>(quotations: Q[]): Map<string, Q[]> {
  const map = new Map<string, Q[]>();
  for (const q of quotations) {
    const list = map.get(q.leadId);
    if (list) list.push(q);
    else map.set(q.leadId, [q]);
  }
  return map;
}
