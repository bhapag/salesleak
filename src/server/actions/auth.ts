"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { getDefaultIntegrationRows } from "@/server/data/ingestion";

export type LoginResult = { success: true } | { success: false; error: string };
export type SignupInput = { companyName: string; ownerName: string; email: string; password: string };
export type SignupResult = { success: true } | { success: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same non-redirecting-here pattern as login() below — called from a client
// component's try/catch, and a server-action redirect() thrown inside that
// boundary can be swallowed instead of navigating.
export async function signup(input: SignupInput): Promise<SignupResult> {
  const companyName = input.companyName.trim();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim().toLowerCase();

  if (!companyName) return { success: false, error: "Company name is required." };
  if (!ownerName) return { success: false, error: "Your name is required." };
  if (!EMAIL_RE.test(email)) return { success: false, error: "Enter a valid email address." };
  if (input.password.length < 8) return { success: false, error: "Password must be at least 8 characters." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { success: false, error: "An account with this email already exists." };

  const company = await prisma.company.create({ data: { name: companyName } });
  const user = await prisma.user.create({
    data: { companyId: company.id, name: ownerName, email, role: "OWNER", passwordHash: hashPassword(input.password) },
  });
  await prisma.integration.createMany({ data: getDefaultIntegrationRows(company.id) });
  await prisma.auditLog.create({
    data: { companyId: company.id, userId: user.id, action: "COMPANY_CREATED", entityType: "Company", entityId: company.id },
  });

  await createSession(user.id);
  return { success: true };
}

// Deliberately does NOT call redirect() here — this is called from a client
// component's try/catch to show the error state, and a server-action
// redirect() thrown inside that boundary can be swallowed instead of
// navigating. The client redirects itself once it sees { success: true }.
export async function login(email: string, password: string): Promise<LoginResult> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !password) {
    return { success: false, error: "Email and password are required." };
  }

  const user = await prisma.user.findUnique({ where: { email: trimmedEmail } });

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return { success: false, error: "Invalid email or password." };
  }

  await createSession(user.id);
  return { success: true };
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
