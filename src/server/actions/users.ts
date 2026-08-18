"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";
import { requireSession } from "@/server/auth/session";
import { canManageCompany, ForbiddenError } from "@/server/auth/permissions";
import { hashPassword } from "@/server/auth/password";

function revalidateTeam() {
  revalidatePath("/team");
  revalidatePath("/", "layout");
}

export async function createTeamUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<{ error?: string }> {
  const session = await requireSession();
  if (!canManageCompany(session.role)) throw new ForbiddenError("Only the Owner can add team members.");

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: "Name is required." };
  if (!email) return { error: "Email is required." };
  if (input.password.length < 8) return { error: "Password must be at least 8 characters." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with this email already exists." };

  const user = await prisma.user.create({
    data: {
      companyId: session.companyId,
      name,
      email,
      role: input.role,
      passwordHash: hashPassword(input.password),
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      metadata: JSON.stringify({ name, email, role: input.role }),
    },
  });

  revalidateTeam();
  return {};
}

async function getOwnedTeamUser(userId: string, companyId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!user) throw new ForbiddenError();
  return user;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const session = await requireSession();
  if (!canManageCompany(session.role)) throw new ForbiddenError("Only the Owner can change roles.");

  const user = await getOwnedTeamUser(userId, session.companyId);
  if (user.role === role) return;

  // A company can never be left with zero active Owners — only meaningful to
  // check when demoting a currently-active Owner; changing an already-
  // inactive Owner's role never reduces the active count.
  if (user.role === "OWNER" && user.isActive && role !== "OWNER") {
    const activeOwnerCount = await prisma.user.count({
      where: { companyId: session.companyId, role: "OWNER", isActive: true },
    });
    if (activeOwnerCount <= 1) {
      throw new Error("This company must have at least one active Owner — promote another teammate to Owner first.");
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: "USER_ROLE_CHANGED",
      entityType: "User",
      entityId: userId,
      metadata: JSON.stringify({ from: user.role, to: role }),
    },
  });

  revalidateTeam();
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const session = await requireSession();
  if (!canManageCompany(session.role)) throw new ForbiddenError("Only the Owner can activate or deactivate users.");
  if (userId === session.userId && !isActive) throw new Error("You can't deactivate your own account.");

  const user = await getOwnedTeamUser(userId, session.companyId);
  if (user.isActive === isActive) return;

  await prisma.user.update({ where: { id: userId }, data: { isActive } });

  if (!isActive) {
    // Deactivating immediately ends any existing sessions for this user.
    await prisma.session.deleteMany({ where: { userId } });
  }

  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "User",
      entityId: userId,
    },
  });

  revalidateTeam();
}
