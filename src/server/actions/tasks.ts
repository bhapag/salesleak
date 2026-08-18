"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/permissions";
import { assertMutationAllowed } from "@/server/billing/entitlements";

function revalidateWorkQueue(leadId: string) {
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/my-day");
  revalidatePath("/team");
  revalidatePath(`/leads/${leadId}`);
}

// `_actingUserId` is accepted for call-site compatibility but ignored —
// activity attribution always uses the authenticated session's own userId,
// never a client-supplied value, same discipline as leads.ts/quotations.ts.
export async function rescheduleTask(taskId: string, newDueDate: string, _actingUserId: string | null) {
  const session = await requireSession();
  await assertMutationAllowed(session);
  if (!newDueDate) throw new Error("A new due date is required.");

  const task = await prisma.task.findFirst({ where: { id: taskId, lead: { companyId: session.companyId } } });
  if (!task) throw new ForbiddenError();

  await prisma.task.update({ where: { id: taskId }, data: { dueDate: new Date(newDueDate) } });

  await prisma.activity.create({
    data: {
      leadId: task.leadId,
      userId: session.userId,
      type: "NOTE",
      notes: `Follow-up "${task.title}" rescheduled to ${formatDate(new Date(newDueDate))}.`,
    },
  });

  revalidateWorkQueue(task.leadId);
}
