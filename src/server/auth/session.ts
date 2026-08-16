import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";

export const SESSION_COOKIE = "salesleak_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type AuthSession = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  companyName: string;
};

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({ data: { userId, token, expiresAt } });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Reads and validates the session cookie against the database. Returns null
 * for: no cookie, unknown/expired token, or a deactivated user — callers
 * that need to distinguish these don't need to; all three mean "not signed
 * in" from the application's point of view.
 *
 * Wrapped in React's `cache()` because both the (app) layout and every page
 * underneath it call this independently (layouts can't pass props to pages
 * in the App Router) — this dedupes the DB lookup to once per request.
 */
export const getSession = cache(async (): Promise<AuthSession | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { company: true } } },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (!session.user.isActive) return null;

  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    companyId: session.user.companyId,
    companyName: session.user.company.name,
  };
});

/** For Server Components/pages: redirects to /login if not signed in. */
export async function requireSession(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
