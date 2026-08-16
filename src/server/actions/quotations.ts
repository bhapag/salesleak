"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { QuotationStatus } from "@/generated/prisma/client";
import { QUOTATION_STATUS_LABEL } from "@/lib/quotationRisk";
import { requireSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/permissions";
import type { AuthSession } from "@/server/auth/session";

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
  const quotation = await prisma.quotation.findFirst({ where: { id: quotationId, lead: { companyId: session.companyId } } });
  if (!quotation) throw new ForbiddenError();
  return quotation;
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

export async function updateQuotationNextAction(
  quotationId: string,
  nextAction: string,
  followUpDate: string,
  actingUserId: string | null
) {
  const session = await requireSession();
  const quotation = await getOwnedQuotation(quotationId, session);

  const trimmed = nextAction.trim();
  if (!trimmed) throw new Error("Next action is required.");
  if (!followUpDate) throw new Error("Follow-up deadline is required.");

  await prisma.quotation.update({
    where: { id: quotationId },
    data: { nextAction: trimmed, followUpDate: new Date(followUpDate) },
  });
  await logOnLead(quotation.leadId, quotation.quotationNumber, actingUserId, `Next action updated: "${trimmed}".`);

  revalidateQuotation(quotationId, quotation.leadId);
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

export async function markQuotationWon(quotationId: string, actingUserId: string | null) {
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

  revalidateQuotation(quotationId, quotation.leadId);
}

export async function markQuotationLost(quotationId: string, lostReason: string, actingUserId: string | null) {
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

  revalidateQuotation(quotationId, quotation.leadId);
}
