"use server";

import { exec } from "child_process";
import { promisify } from "util";
import { redirect } from "next/navigation";
import { requireSession, destroySession } from "@/server/auth/session";
import { canManageCompany, ForbiddenError } from "@/server/auth/permissions";

const execAsync = promisify(exec);

export type ResetDemoDataResult = { error?: string };

const CONFIRMATION_PHRASE = "RESET DEMO DATA";

/**
 * Local development only — hard-gated on NODE_ENV so it can never run in a
 * deployed environment even if a bad actor obtained Owner access there.
 * Reseeding wipes and recreates the Session table along with everything
 * else, so the caller's own session is gone by the time this returns —
 * destroySession()+redirect() mirrors logout()'s pattern of calling
 * redirect() outside any try/catch so its internal throw isn't swallowed.
 */
export async function resetDemoData(confirmation: string): Promise<ResetDemoDataResult> {
  if (process.env.NODE_ENV === "production") {
    throw new ForbiddenError("Demo data reset is never available in production.");
  }

  const session = await requireSession();
  if (!canManageCompany(session.role)) throw new ForbiddenError("Only the Owner can reset demo data.");

  if (confirmation.trim() !== CONFIRMATION_PHRASE) {
    return { error: `Type "${CONFIRMATION_PHRASE}" exactly to confirm.` };
  }

  try {
    await execAsync("npx prisma db seed", { cwd: process.cwd() });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Reset failed. Check the server logs." };
  }

  await destroySession();
  redirect("/login");
}
