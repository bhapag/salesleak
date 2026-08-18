"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@/generated/prisma/client";
import { notifyNewLeadAssigned } from "@/server/data/notifications";
import { requireSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/permissions";
import type { AuthSession } from "@/server/auth/session";
import { assertMutationAllowed } from "@/server/billing/entitlements";

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
  // Same chokepoint as tenant isolation above — every write action for an
  // existing lead routes through here, so this is the one place Phase 14's
  // "read-only once a subscription lapses" rule needs to be enforced for
  // that whole family of actions (see src/server/billing/entitlements.ts).
  await assertMutationAllowed(session);
  const lead = await prisma.lead.findFirst({ where: { id: leadId, companyId: session.companyId } });
  if (!lead) throw new ForbiddenError();
  return lead;
}

// Every action below accepts a leftover `_actingUserId` parameter for call-
// site compatibility, but ignores it — Activity/AuditLog attribution is
// always the authenticated session's own userId, never a client-supplied
// value, so one user can never make an action record claim another user did
// it. Kept as a parameter (not removed) so none of this file's many callers
// need to change; the parameter itself is simply dead going forward.

export async function markContacted(leadId: string, _actingUserId: string | null) {
  const session = await requireSession();
  const lead = await getOwnedLead(leadId, session);

  if (lead.status === "NEW") {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "CONTACTED" } });
    await prisma.activity.create({
      data: { leadId, userId: session.userId, type: "STATUS_CHANGE", notes: "Marked as contacted (New → Contacted)." },
    });
  } else {
    await prisma.activity.create({
      data: { leadId, userId: session.userId, type: "NOTE", notes: "Marked as contacted." },
    });
  }

  revalidateLead(leadId);
}

export async function changeStatus(leadId: string, status: Exclude<LeadStatus, "WON" | "LOST">, _actingUserId: string | null) {
  const session = await requireSession();
  const lead = await getOwnedLead(leadId, session);
  if (lead.status === status) return;

  await prisma.lead.update({ where: { id: leadId }, data: { status } });
  await prisma.activity.create({
    data: {
      leadId,
      userId: session.userId,
      type: "STATUS_CHANGE",
      notes: `Status changed: ${lead.status.replace("_", " ")} → ${status.replace("_", " ")}.`,
    },
  });

  revalidateLead(leadId);
}

export async function assignSalesperson(leadId: string, ownerId: string | null, _actingUserId: string | null) {
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
      userId: session.userId,
      type: "NOTE",
      notes: newOwner ? `Assigned to ${newOwner.name}.` : `Unassigned (was ${previousOwner?.name ?? "unassigned"}).`,
    },
  });
  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
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

export type LeadActionResult = { success: true } | { success: false; error: string };

// Returns a result object rather than throwing for ordinary validation
// failures — Next.js redacts thrown Server Action error messages in
// production, so a plain throw here would reach the client as a generic,
// unhelpful message instead of "Deadline is required."
export async function updateNextAction(
  leadId: string,
  nextAction: string,
  nextActionDeadline: string,
  _actingUserId: string | null
): Promise<LeadActionResult> {
  const session = await requireSession();
  await getOwnedLead(leadId, session);

  const trimmedAction = nextAction.trim();
  if (!trimmedAction) return { success: false, error: "Next action is required." };
  if (!nextActionDeadline) return { success: false, error: "Deadline is required." };

  await prisma.lead.update({
    where: { id: leadId },
    data: { nextAction: trimmedAction, nextActionDeadline: new Date(nextActionDeadline) },
  });
  await prisma.activity.create({
    data: { leadId, userId: session.userId, type: "NOTE", notes: `Next action updated: "${trimmedAction}".` },
  });

  revalidateLead(leadId);
  return { success: true };
}

export async function scheduleFollowUp(
  leadId: string,
  title: string,
  dueDate: string,
  assignedToId: string | null,
  _actingUserId: string | null
): Promise<LeadActionResult> {
  const session = await requireSession();
  await getOwnedLead(leadId, session);

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { success: false, error: "Follow-up title is required." };
  if (!dueDate) return { success: false, error: "Due date is required." };

  await prisma.task.create({
    data: { leadId, title: trimmedTitle, dueDate: new Date(dueDate), assignedToId },
  });
  await prisma.activity.create({
    data: { leadId, userId: session.userId, type: "NOTE", notes: `Follow-up scheduled: "${trimmedTitle}".` },
  });

  revalidateLead(leadId);
  return { success: true };
}

export async function completeTask(taskId: string, leadId: string, _actingUserId: string | null) {
  const session = await requireSession();
  await getOwnedLead(leadId, session);

  const task = await prisma.task.findFirst({ where: { id: taskId, leadId } });
  if (!task) throw new ForbiddenError();

  await prisma.task.update({ where: { id: taskId }, data: { status: "COMPLETED", completedAt: new Date() } });
  await prisma.activity.create({
    data: { leadId, userId: session.userId, type: "NOTE", notes: `Follow-up completed: "${task.title}".` },
  });

  revalidateLead(leadId);
}

export async function addNote(leadId: string, notes: string, _actingUserId: string | null) {
  const session = await requireSession();
  await getOwnedLead(leadId, session);

  const trimmed = notes.trim();
  if (!trimmed) throw new Error("Note cannot be empty.");

  await prisma.activity.create({ data: { leadId, userId: session.userId, type: "NOTE", notes: trimmed } });

  revalidateLead(leadId);
}

export async function markWon(leadId: string, _actingUserId: string | null) {
  const session = await requireSession();
  const lead = await getOwnedLead(leadId, session);

  await prisma.lead.update({ where: { id: leadId }, data: { status: "WON", wonAt: new Date() } });
  await prisma.activity.create({
    data: { leadId, userId: session.userId, type: "STATUS_CHANGE", notes: `Marked as Won (was ${lead.status.replace("_", " ")}).` },
  });
  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: "LEAD_WON",
      entityType: "Lead",
      entityId: leadId,
      metadata: JSON.stringify({ from: lead.status, value: lead.estimatedValue }),
    },
  });

  revalidateLead(leadId);
}

export async function markLost(leadId: string, lostReason: string, _actingUserId: string | null) {
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
      userId: session.userId,
      type: "STATUS_CHANGE",
      notes: `Marked as Lost (was ${lead.status.replace("_", " ")}). Reason: ${trimmed}`,
    },
  });
  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: "LEAD_LOST",
      entityType: "Lead",
      entityId: leadId,
      metadata: JSON.stringify({ from: lead.status, reason: trimmed }),
    },
  });

  revalidateLead(leadId);
}
