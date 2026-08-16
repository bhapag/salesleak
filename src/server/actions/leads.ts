"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@/generated/prisma/client";
import { notifyNewLeadAssigned } from "@/server/data/notifications";
import { requireSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/permissions";
import type { AuthSession } from "@/server/auth/session";

function revalidateLead(leadId: string) {
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/tasks");
  revalidatePath("/my-day");
  revalidatePath("/team", "layout");
}

// Every action fetches the lead scoped by the caller's companyId — a leadId
// from another tenant simply won't be found, never mutated. This is the
// server-side enforcement point; nothing upstream (UI, client state) is
// trusted for tenant isolation.
async function getOwnedLead(leadId: string, session: AuthSession) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, companyId: session.companyId } });
  if (!lead) throw new ForbiddenError();
  return lead;
}

export async function markContacted(leadId: string, actingUserId: string | null) {
  const session = await requireSession();
  const lead = await getOwnedLead(leadId, session);

  if (lead.status === "NEW") {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "CONTACTED" } });
    await prisma.activity.create({
      data: { leadId, userId: actingUserId, type: "STATUS_CHANGE", notes: "Marked as contacted (New → Contacted)." },
    });
  } else {
    await prisma.activity.create({
      data: { leadId, userId: actingUserId, type: "NOTE", notes: "Marked as contacted." },
    });
  }

  revalidateLead(leadId);
}

export async function changeStatus(leadId: string, status: Exclude<LeadStatus, "WON" | "LOST">, actingUserId: string | null) {
  const session = await requireSession();
  const lead = await getOwnedLead(leadId, session);
  if (lead.status === status) return;

  await prisma.lead.update({ where: { id: leadId }, data: { status } });
  await prisma.activity.create({
    data: {
      leadId,
      userId: actingUserId,
      type: "STATUS_CHANGE",
      notes: `Status changed: ${lead.status.replace("_", " ")} → ${status.replace("_", " ")}.`,
    },
  });

  revalidateLead(leadId);
}

export async function assignSalesperson(leadId: string, ownerId: string | null, actingUserId: string | null) {
  const session = await requireSession();
  const lead = await getOwnedLead(leadId, session);
  const previousOwner = lead.ownerId ? await prisma.user.findUnique({ where: { id: lead.ownerId } }) : null;

  // The new owner must be a real user in the same company, never just trusted
  // from the client — findFirst (not findUniqueOrThrow) enforces that scope.
  const newOwner = ownerId ? await prisma.user.findFirst({ where: { id: ownerId, companyId: session.companyId } }) : null;
  if (ownerId && !newOwner) throw new ForbiddenError();

  await prisma.lead.update({ where: { id: leadId }, data: { ownerId } });
  await prisma.activity.create({
    data: {
      leadId,
      userId: actingUserId,
      type: "NOTE",
      notes: newOwner ? `Assigned to ${newOwner.name}.` : `Unassigned (was ${previousOwner?.name ?? "unassigned"}).`,
    },
  });
  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: actingUserId,
      action: "LEAD_OWNER_CHANGED",
      entityType: "Lead",
      entityId: leadId,
      metadata: JSON.stringify({ from: previousOwner?.name ?? null, to: newOwner?.name ?? null }),
    },
  });

  if (newOwner && newOwner.id !== lead.ownerId) {
    await notifyNewLeadAssigned(lead.companyId, leadId, lead.title, newOwner.id);
  }

  revalidateLead(leadId);
}

export async function updateNextAction(
  leadId: string,
  nextAction: string,
  nextActionDeadline: string,
  actingUserId: string | null
) {
  const session = await requireSession();
  await getOwnedLead(leadId, session);

  const trimmedAction = nextAction.trim();
  if (!trimmedAction) throw new Error("Next action is required.");
  if (!nextActionDeadline) throw new Error("Deadline is required.");

  await prisma.lead.update({
    where: { id: leadId },
    data: { nextAction: trimmedAction, nextActionDeadline: new Date(nextActionDeadline) },
  });
  await prisma.activity.create({
    data: { leadId, userId: actingUserId, type: "NOTE", notes: `Next action updated: "${trimmedAction}".` },
  });

  revalidateLead(leadId);
}

export async function scheduleFollowUp(
  leadId: string,
  title: string,
  dueDate: string,
  assignedToId: string | null,
  actingUserId: string | null
) {
  const session = await requireSession();
  await getOwnedLead(leadId, session);

  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error("Follow-up title is required.");
  if (!dueDate) throw new Error("Due date is required.");

  await prisma.task.create({
    data: { leadId, title: trimmedTitle, dueDate: new Date(dueDate), assignedToId },
  });
  await prisma.activity.create({
    data: { leadId, userId: actingUserId, type: "NOTE", notes: `Follow-up scheduled: "${trimmedTitle}".` },
  });

  revalidateLead(leadId);
}

export async function completeTask(taskId: string, leadId: string, actingUserId: string | null) {
  const session = await requireSession();
  await getOwnedLead(leadId, session);

  const task = await prisma.task.findFirst({ where: { id: taskId, leadId } });
  if (!task) throw new ForbiddenError();

  await prisma.task.update({ where: { id: taskId }, data: { status: "COMPLETED", completedAt: new Date() } });
  await prisma.activity.create({
    data: { leadId, userId: actingUserId, type: "NOTE", notes: `Follow-up completed: "${task.title}".` },
  });

  revalidateLead(leadId);
}

export async function addNote(leadId: string, notes: string, actingUserId: string | null) {
  const session = await requireSession();
  await getOwnedLead(leadId, session);

  const trimmed = notes.trim();
  if (!trimmed) throw new Error("Note cannot be empty.");

  await prisma.activity.create({ data: { leadId, userId: actingUserId, type: "NOTE", notes: trimmed } });

  revalidateLead(leadId);
}

export async function markWon(leadId: string, actingUserId: string | null) {
  const session = await requireSession();
  const lead = await getOwnedLead(leadId, session);

  await prisma.lead.update({ where: { id: leadId }, data: { status: "WON", wonAt: new Date() } });
  await prisma.activity.create({
    data: { leadId, userId: actingUserId, type: "STATUS_CHANGE", notes: `Marked as Won (was ${lead.status.replace("_", " ")}).` },
  });
  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: actingUserId,
      action: "LEAD_WON",
      entityType: "Lead",
      entityId: leadId,
      metadata: JSON.stringify({ from: lead.status, value: lead.estimatedValue }),
    },
  });

  revalidateLead(leadId);
}

export async function markLost(leadId: string, lostReason: string, actingUserId: string | null) {
  const session = await requireSession();
  const lead = await getOwnedLead(leadId, session);

  const trimmed = lostReason.trim();
  if (!trimmed) throw new Error("A lost reason is required.");

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "LOST", lostAt: new Date(), lostReason: trimmed },
  });
  await prisma.activity.create({
    data: {
      leadId,
      userId: actingUserId,
      type: "STATUS_CHANGE",
      notes: `Marked as Lost (was ${lead.status.replace("_", " ")}). Reason: ${trimmed}`,
    },
  });
  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: actingUserId,
      action: "LEAD_LOST",
      entityType: "Lead",
      entityId: leadId,
      metadata: JSON.stringify({ from: lead.status, reason: trimmed }),
    },
  });

  revalidateLead(leadId);
}
