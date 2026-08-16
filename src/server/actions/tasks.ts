"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/permissions";

function revalidateWorkQueue(leadId: string) {
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/my-day");
  revalidatePath("/team");
  revalidatePath(`/leads/${leadId}`);
}

export async function rescheduleTask(taskId: string, newDueDate: string, actingUserId: string | null) {
  const session = await requireSession();
  if (!newDueDate) throw new Error("A new due date is required.");

  const task = await prisma.task.findFirst({ where: { id: taskId, lead: { companyId: session.companyId } } });
  if (!task) throw new ForbiddenError();

  await prisma.task.update({ where: { id: taskId }, data: { dueDate: new Date(newDueDate) } });

  await prisma.activity.create({
    data: {
      leadId: task.leadId,
      userId: actingUserId,
      type: "NOTE",
      notes: `Follow-up "${task.title}" rescheduled to ${formatDate(new Date(newDueDate))}.`,
    },
  });

  revalidateWorkQueue(task.leadId);
}
