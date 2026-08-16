"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { ForbiddenError } from "@/server/auth/permissions";

export async function markNotificationRead(notificationId: string) {
  const session = await requireSession();

  const notification = await prisma.notification.findFirst({ where: { id: notificationId, companyId: session.companyId } });
  if (!notification) throw new ForbiddenError();

  await prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const session = await requireSession();

  await prisma.notification.updateMany({
    where: { companyId: session.companyId, isRead: false, OR: [{ userId: session.userId }, { userId: null }] },
    data: { isRead: true },
  });
  revalidatePath("/", "layout");
}
