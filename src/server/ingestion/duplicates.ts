import { prisma } from "@/lib/prisma";
import { normalizePhone, normalizeEmail } from "@/lib/contactMatch";
import type { NormalizedLeadInput } from "./types";

type CustomerContact = { id: string; name: string; phone: string | null; email: string | null };

/**
 * Finds an existing customer in the same company by phone or email. Small
 * per-company customer counts make an in-memory match simpler and just as
 * correct as a fuzzy DB query, and it's the same normalization used by the
 * CSV import wizard's client-side preview.
 */
export async function findMatchingCustomer(companyId: string, input: { phone?: string | null; email?: string | null }) {
  const normPhone = normalizePhone(input.phone);
  const normEmail = normalizeEmail(input.email);
  if (!normPhone && !normEmail) return null;

  const candidates: CustomerContact[] = await prisma.customer.findMany({
    where: { companyId },
    select: { id: true, name: true, phone: true, email: true },
  });

  return (
    candidates.find(
      (c) => (normPhone && normalizePhone(c.phone) === normPhone) || (normEmail && normalizeEmail(c.email) === normEmail)
    ) ?? null
  );
}

export type DuplicateCheck =
  | { kind: "none" }
  | { kind: "exact"; reason: string }
  | { kind: "possible"; reason: string; matchedCustomerId: string; matchedCustomerName: string; matchedLeadId: string };

const RECENT_WINDOW_DAYS = 3;

/**
 * Two tiers, per the phase brief: "exact" (same source + external lead id
 * already ingested — always blocked, no override) and "possible" (same
 * customer already has a very recent open enquiry — surfaced for a human to
 * decide, never auto-merged or auto-skipped). A returning customer with an
 * older or already-closed lead is NOT flagged — multiple genuine enquiries
 * per customer over time is normal, not a duplicate.
 */
export async function checkForDuplicate(companyId: string, input: NormalizedLeadInput): Promise<DuplicateCheck> {
  if (input.externalLeadId) {
    const existing = await prisma.ingestionRecord.findFirst({
      where: { companyId, source: input.source, externalLeadId: input.externalLeadId, status: "CREATED" },
    });
    if (existing) {
      return { kind: "exact", reason: `Already imported from ${input.source} (external ID ${input.externalLeadId}).` };
    }
  }

  const matchedCustomer = await findMatchingCustomer(companyId, input);
  if (!matchedCustomer) return { kind: "none" };

  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recentLead = await prisma.lead.findFirst({
    where: { companyId, customerId: matchedCustomer.id, status: { notIn: ["WON", "LOST"] }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  if (!recentLead) return { kind: "none" };

  return {
    kind: "possible",
    reason: `${matchedCustomer.name} already has a recent open enquiry ("${recentLead.title}").`,
    matchedCustomerId: matchedCustomer.id,
    matchedCustomerName: matchedCustomer.name,
    matchedLeadId: recentLead.id,
  };
}
