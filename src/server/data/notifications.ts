import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getLeadsForCompany } from "./leads";
import { getQuotationsForCompany } from "./quotations";
import { getCustomersForCompany } from "./customers";

export type NotificationType =
  | "NEW_LEAD_ASSIGNED"
  | "FOLLOW_UP_DUE"
  | "FOLLOW_UP_OVERDUE"
  | "QUOTATION_OVERDUE"
  | "MISSING_NEXT_ACTION"
  | "HIGH_VALUE_ATTENTION"
  | "REPEAT_ORDER";

type NotificationEntityType = "Lead" | "Quotation" | "Customer";

type Candidate = {
  type: NotificationType;
  // Always a concrete user — every notification here targets a specific
  // person (see syncNotifications' `continue` guards below); Prisma's
  // generated compound-unique input can't be looked up with a null field.
  userId: string;
  message: string;
  entityType: NotificationEntityType;
  entityId: string;
};

/**
 * One notification "slot" per (company, type, entity, recipient) — enforced
 * by a DB unique constraint, not just an application-level check, because
 * this function is called from multiple places in the same request (the
 * header and the dashboard's unread count) and a plain find-then-create is
 * racy: two concurrent calls can both see "no existing row" and both insert,
 * producing duplicates. The unique constraint makes that impossible; the
 * try/catch below just means a losing concurrent insert is a silent no-op
 * instead of a crash.
 */
async function upsertCandidate(companyId: string, candidate: Candidate) {
  const key = {
    companyId_type_entityType_entityId_userId: {
      companyId,
      type: candidate.type,
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      userId: candidate.userId,
    },
  };

  const existing = await prisma.notification.findUnique({ where: key });

  if (existing) {
    // If it was already dismissed but the condition is still true, resurface
    // it; if it's still sitting unread, leave it alone (no re-notify spam).
    if (existing.isRead) {
      await prisma.notification.update({ where: key, data: { isRead: false, message: candidate.message, createdAt: new Date() } });
    }
    return;
  }

  try {
    await prisma.notification.create({
      data: {
        companyId,
        userId: candidate.userId,
        type: candidate.type,
        message: candidate.message,
        entityType: candidate.entityType,
        entityId: candidate.entityId,
      },
    });
  } catch (e) {
    const isDuplicate = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
    if (!isDuplicate) throw e;
  }
}

/**
 * Generates notification rows for currently-true conditions, reusing the
 * same lead/quotation/customer risk logic every other page uses — nothing
 * here is computed independently. Wrapped in React's `cache()` so multiple
 * reads within one request (header + dashboard count) only do this work
 * once; the unique-constraint upsert above is what guarantees correctness
 * even so. Safe to call repeatedly across requests.
 */
export const syncNotifications = cache(async (companyId: string): Promise<void> => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [leads, quotations, customers, tasks] = await Promise.all([
    getLeadsForCompany(companyId),
    getQuotationsForCompany(companyId),
    getCustomersForCompany(companyId),
    prisma.task.findMany({ where: { status: "PENDING", lead: { companyId } }, include: { lead: true } }),
  ]);

  const candidates: Candidate[] = [];

  for (const task of tasks) {
    const dueDay = new Date(task.dueDate.getFullYear(), task.dueDate.getMonth(), task.dueDate.getDate());
    const userId = task.assignedToId ?? task.lead.ownerId;
    if (!userId) continue;
    if (dueDay.getTime() === today.getTime()) {
      candidates.push({ type: "FOLLOW_UP_DUE", userId, message: `Follow-up due today: "${task.title}"`, entityType: "Lead", entityId: task.leadId });
    } else if (dueDay < today) {
      candidates.push({
        type: "FOLLOW_UP_OVERDUE",
        userId,
        message: `Follow-up overdue: "${task.title}"`,
        entityType: "Lead",
        entityId: task.leadId,
      });
    }
  }

  for (const lead of leads) {
    if (!lead.risk.isActive || !lead.ownerId) continue;
    if (lead.risk.missingNextAction || lead.risk.missingDeadline) {
      candidates.push({
        type: "MISSING_NEXT_ACTION",
        userId: lead.ownerId,
        message: `Lead needs a next action: "${lead.title}"`,
        entityType: "Lead",
        entityId: lead.id,
      });
    }
    if (lead.risk.isHighRiskOpportunity) {
      candidates.push({
        type: "HIGH_VALUE_ATTENTION",
        userId: lead.ownerId,
        message: `High-value opportunity needs attention: "${lead.title}"`,
        entityType: "Lead",
        entityId: lead.id,
      });
    }
  }

  for (const quotation of quotations) {
    if (quotation.risk.isOverdueFollowUp && quotation.lead.ownerId) {
      candidates.push({
        type: "QUOTATION_OVERDUE",
        userId: quotation.lead.ownerId,
        message: `Quotation follow-up overdue: ${quotation.quotationNumber} (${quotation.lead.customer.name})`,
        entityType: "Quotation",
        entityId: quotation.id,
      });
    }
  }

  for (const customer of customers) {
    const isRepeatDue = customer.repeatOrderSignal.eligible && customer.repeatOrderSignal.status !== "Normal" && customer.repeatOrderSignal.status !== "Due Soon";
    if (isRepeatDue && customer.assignedSalesperson) {
      candidates.push({
        type: "REPEAT_ORDER",
        userId: customer.assignedSalesperson.id,
        message: `Possible repeat-order opportunity: ${customer.name}`,
        entityType: "Customer",
        entityId: customer.id,
      });
    }
  }

  for (const candidate of candidates) {
    await upsertCandidate(companyId, candidate);
  }
});

export async function getNotificationsForUser(companyId: string, userId: string) {
  await syncNotifications(companyId);

  return prisma.notification.findMany({
    where: { companyId, OR: [{ userId }, { userId: null }] },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

export type NotificationWithMeta = Awaited<ReturnType<typeof getNotificationsForUser>>[number];

export async function notifyNewLeadAssigned(companyId: string, leadId: string, leadTitle: string, ownerId: string) {
  await upsertCandidate(companyId, {
    type: "NEW_LEAD_ASSIGNED",
    userId: ownerId,
    message: `Lead assigned to you: "${leadTitle}"`,
    entityType: "Lead",
    entityId: leadId,
  });
}
