"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { QuotationStatus } from "@/generated/prisma/client";
import { QUOTATION_STATUS_LABEL } from "@/lib/quotationRisk";
import { formatCurrency } from "@/lib/format";
import { QUOTATION_ACTIVE_STATUSES } from "@/lib/constants";
import { requireSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/permissions";
import type { AuthSession } from "@/server/auth/session";
import { markWon as markLeadWon, markLost as markLeadLost } from "@/server/actions/leads";
import { assertMutationAllowed } from "@/server/billing/entitlements";

// Quotation actions write their activity onto the linked Lead's timeline —
// Quotation has no activity log of its own, and the product requirement is
// that quotation actions are visible from the Lead's history too.
async function logOnLead(leadId: string, quotationNumber: string, userId: string | null, notes: string) {
  await prisma.activity.create({
    data: { leadId, userId, type: "NOTE", notes: `[${quotationNumber}] ${notes}` },
  });
}

function revalidateQuotation(quotationId: string, leadId: string) {
  revalidatePath("/");
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/tasks");
  revalidatePath("/my-day");
  revalidatePath("/team", "layout");
}

// Quotation has no companyId column of its own, so tenant scoping goes
// through its lead — same enforcement point as leads.ts's getOwnedLead.
async function getOwnedQuotation(quotationId: string, session: AuthSession) {
  await assertMutationAllowed(session);
  const quotation = await prisma.quotation.findFirst({ where: { id: quotationId, lead: { companyId: session.companyId } } });
  if (!quotation) throw new ForbiddenError();
  return quotation;
}

export type CreateQuotationLineInput = {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type CreateQuotationInput = {
  leadId: string;
  quotationNumber: string;
  items: CreateQuotationLineInput[];
  sentAt: string | null;
  validUntil: string | null;
  nextAction: string | null;
  followUpDate: string | null;
  notes: string | null;
};

export type CreateQuotationResult = { success: true; quotationId: string } | { success: false; error: string };

/**
 * The only place a Quotation is created. Totals are always computed here from
 * quantity × unitPrice — a client-submitted total/value is never accepted or
 * trusted. Returns a result object rather than throwing for ordinary
 * validation failures, so the form can show an inline message instead of a
 * generic server-action error (same fix as scheduleFollowUp/updateNextAction).
 */
export async function createQuotation(input: CreateQuotationInput, actingUserId: string | null): Promise<CreateQuotationResult> {
  const session = await requireSession();
  await assertMutationAllowed(session);

  // Tenant isolation: a leadId from another company simply won't be found.
  const lead = await prisma.lead.findFirst({ where: { id: input.leadId, companyId: session.companyId } });
  if (!lead) throw new ForbiddenError();

  const quotationNumber = input.quotationNumber.trim();
  if (!quotationNumber) return { success: false, error: "Quotation number is required." };

  const cleanItems = input.items
    .map((item) => ({ ...item, description: item.description.trim() }))
    .filter((item) => item.description.length > 0 || item.productId);
  if (cleanItems.length === 0) return { success: false, error: "Add at least one line item." };

  for (const item of cleanItems) {
    if (!item.description) return { success: false, error: "Every line item needs a description." };
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return { success: false, error: `Quantity for "${item.description}" must be greater than zero.` };
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      return { success: false, error: `Unit price for "${item.description}" can't be negative.` };
    }
  }

  if (input.followUpDate && !input.nextAction?.trim()) {
    return { success: false, error: "Add a next action to go with the follow-up deadline." };
  }
  if (input.nextAction?.trim() && !input.followUpDate) {
    return { success: false, error: "Add a follow-up deadline to go with the next action." };
  }

  // Any referenced product must belong to the caller's company — never trust
  // a productId from the client without re-checking it server-side.
  const productIds = [...new Set(cleanItems.map((i) => i.productId).filter((id): id is string => !!id))];
  if (productIds.length > 0) {
    const validProducts = await prisma.product.findMany({ where: { id: { in: productIds }, companyId: session.companyId } });
    if (validProducts.length !== productIds.length) throw new ForbiddenError();
  }

  const itemsData = cleanItems.map((item) => ({
    productId: item.productId,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: Math.round(item.quantity * item.unitPrice * 100) / 100,
  }));
  const value = Math.round(itemsData.reduce((sum, i) => sum + i.total, 0) * 100) / 100;

  const sentAt = input.sentAt ? new Date(input.sentAt) : null;
  const status: QuotationStatus = sentAt ? "SENT" : "DRAFT";

  const quotation = await prisma.quotation.create({
    data: {
      leadId: lead.id,
      quotationNumber,
      value,
      status,
      sentAt,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      nextAction: input.nextAction?.trim() || null,
      followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
      items: { create: itemsData },
    },
  });

  const notes = input.notes?.trim();
  await logOnLead(
    lead.id,
    quotationNumber,
    actingUserId,
    `Quotation created${status === "SENT" ? " and sent" : " as draft"} — ${itemsData.length} item${itemsData.length === 1 ? "" : "s"}, ${formatCurrency(value)}.${notes ? ` ${notes}` : ""}`
  );
  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: actingUserId,
      action: "QUOTATION_CREATED",
      entityType: "Quotation",
      entityId: quotation.id,
      metadata: JSON.stringify({ leadId: lead.id, quotationNumber, value, status }),
    },
  });

  revalidateQuotation(quotation.id, lead.id);
  return { success: true, quotationId: quotation.id };
}

export async function markQuotationSent(quotationId: string, actingUserId: string | null) {
  const session = await requireSession();
  const quotation = await getOwnedQuotation(quotationId, session);

  await prisma.quotation.update({
    where: { id: quotationId },
    data: { status: "SENT", sentAt: quotation.sentAt ?? new Date() },
  });
  await logOnLead(quotation.leadId, quotation.quotationNumber, actingUserId, "Quotation marked as sent.");

  revalidateQuotation(quotationId, quotation.leadId);
}

export async function changeQuotationStatus(
  quotationId: string,
  status: Exclude<QuotationStatus, "ACCEPTED" | "REJECTED">,
  actingUserId: string | null
) {
  const session = await requireSession();
  const quotation = await getOwnedQuotation(quotationId, session);
  if (quotation.status === status) return;

  await prisma.quotation.update({ where: { id: quotationId }, data: { status } });
  await logOnLead(
    quotation.leadId,
    quotation.quotationNumber,
    actingUserId,
    `Status changed: ${QUOTATION_STATUS_LABEL[quotation.status]} → ${QUOTATION_STATUS_LABEL[status]}.`
  );
  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: actingUserId,
      action: "QUOTATION_STATUS_CHANGED",
      entityType: "Quotation",
      entityId: quotationId,
      metadata: JSON.stringify({ from: quotation.status, to: status }),
    },
  });

  revalidateQuotation(quotationId, quotation.leadId);
}

export type UpdateNextActionResult = { success: true } | { success: false; error: string };

// Returns a result object rather than throwing for ordinary validation
// failures — Next.js redacts thrown Server Action error messages in
// production, so a plain throw here would reach the client as a generic,
// unhelpful message instead of "Follow-up deadline is required."
export async function updateQuotationNextAction(
  quotationId: string,
  nextAction: string,
  followUpDate: string,
  actingUserId: string | null
): Promise<UpdateNextActionResult> {
  const session = await requireSession();
  const quotation = await getOwnedQuotation(quotationId, session);

  const trimmed = nextAction.trim();
  if (!trimmed) return { success: false, error: "Next action is required." };
  if (!followUpDate) return { success: false, error: "Follow-up deadline is required." };

  await prisma.quotation.update({
    where: { id: quotationId },
    data: { nextAction: trimmed, followUpDate: new Date(followUpDate) },
  });
  await logOnLead(quotation.leadId, quotation.quotationNumber, actingUserId, `Next action updated: "${trimmed}".`);

  revalidateQuotation(quotationId, quotation.leadId);
  return { success: true };
}

export async function addQuotationNote(quotationId: string, notes: string, actingUserId: string | null) {
  const session = await requireSession();
  const quotation = await getOwnedQuotation(quotationId, session);

  const trimmed = notes.trim();
  if (!trimmed) throw new Error("Note cannot be empty.");

  await logOnLead(quotation.leadId, quotation.quotationNumber, actingUserId, trimmed);
  // Touch updatedAt so "no recent activity" staleness tracking reflects this note.
  await prisma.quotation.update({ where: { id: quotationId }, data: { updatedAt: new Date() } });

  revalidateQuotation(quotationId, quotation.leadId);
}

/**
 * alsoMarkLeadWon (Phase 13) is an explicit, opt-in checkbox on the client —
 * never automatic. Winning a quotation is a reasonable enough signal that
 * the lead itself is won that we offer it, but we still only apply it if
 * the lead isn't already closed (never overwrite an existing Won/Lost).
 */
export async function markQuotationWon(quotationId: string, actingUserId: string | null, alsoMarkLeadWon = false) {
  const session = await requireSession();
  const quotation = await getOwnedQuotation(quotationId, session);

  await prisma.quotation.update({ where: { id: quotationId }, data: { status: "ACCEPTED", wonAt: new Date() } });
  await logOnLead(
    quotation.leadId,
    quotation.quotationNumber,
    actingUserId,
    `Quotation marked as Won (was ${QUOTATION_STATUS_LABEL[quotation.status]}).`
  );
  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: actingUserId,
      action: "QUOTATION_STATUS_CHANGED",
      entityType: "Quotation",
      entityId: quotationId,
      metadata: JSON.stringify({ from: quotation.status, to: "ACCEPTED", value: quotation.value }),
    },
  });

  if (alsoMarkLeadWon) {
    const lead = await prisma.lead.findFirst({ where: { id: quotation.leadId, companyId: session.companyId } });
    if (lead && lead.status !== "WON" && lead.status !== "LOST") {
      await markLeadWon(lead.id, actingUserId);
    }
  }

  revalidateQuotation(quotationId, quotation.leadId);
}

/**
 * alsoMarkLeadLost (Phase 13) is the same opt-in checkbox pattern as Won,
 * with one extra guard: never mark the lead Lost while it still has other
 * open quotations (DRAFT/SENT/FOLLOWED_UP) — losing one quote isn't losing
 * the whole opportunity if another is still in play. This is re-checked
 * server-side regardless of what the client sends, same discipline as never
 * trusting a client-submitted total.
 */
export async function markQuotationLost(
  quotationId: string,
  lostReason: string,
  actingUserId: string | null,
  alsoMarkLeadLost = false
) {
  const session = await requireSession();
  const quotation = await getOwnedQuotation(quotationId, session);

  const trimmed = lostReason.trim();
  if (!trimmed) throw new Error("A lost reason is required.");

  await prisma.quotation.update({
    where: { id: quotationId },
    data: { status: "REJECTED", lostAt: new Date(), lostReason: trimmed },
  });
  await logOnLead(
    quotation.leadId,
    quotation.quotationNumber,
    actingUserId,
    `Quotation marked as Lost (was ${QUOTATION_STATUS_LABEL[quotation.status]}). Reason: ${trimmed}`
  );
  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: actingUserId,
      action: "QUOTATION_STATUS_CHANGED",
      entityType: "Quotation",
      entityId: quotationId,
      metadata: JSON.stringify({ from: quotation.status, to: "REJECTED", reason: trimmed }),
    },
  });

  if (alsoMarkLeadLost) {
    const otherOpenQuotations = await prisma.quotation.count({
      where: { leadId: quotation.leadId, id: { not: quotationId }, status: { in: [...QUOTATION_ACTIVE_STATUSES] } },
    });
    if (otherOpenQuotations === 0) {
      const lead = await prisma.lead.findFirst({ where: { id: quotation.leadId, companyId: session.companyId } });
      if (lead && lead.status !== "WON" && lead.status !== "LOST") {
        await markLeadLost(lead.id, trimmed, actingUserId);
      }
    }
  }

  revalidateQuotation(quotationId, quotation.leadId);
}
