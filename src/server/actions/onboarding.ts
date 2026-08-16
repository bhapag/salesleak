"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { LeadPriority, LeadSource } from "@/generated/prisma/client";
import { requireSession } from "@/server/auth/session";
import { canManageCompany, ForbiddenError } from "@/server/auth/permissions";
import { createTeamUser } from "@/server/actions/users";

export type OnboardingSettingsInput = {
  companyName: string;
  industry: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  timezone: string;
  currency: string;
  highValueThreshold: number;
  defaultPriority: LeadPriority;
  lostReasonPresets: string[];
  activeLeadSources: LeadSource[];
  defaultFollowUpDays: number;
  staleQuotationDays: number;
};

/**
 * Persists everything gathered across the onboarding wizard's company/workflow
 * steps in one write — the wizard itself is entirely client-side state until
 * this point, so there's nothing to save until the owner reaches the lead
 * import step.
 */
export async function saveOnboardingSettings(input: OnboardingSettingsInput): Promise<{ error?: string }> {
  const session = await requireSession();
  if (!canManageCompany(session.role)) throw new ForbiddenError("Only the Owner can configure company settings.");

  const name = input.companyName.trim();
  if (!name) return { error: "Company name is required." };

  await prisma.company.update({
    where: { id: session.companyId },
    data: {
      name,
      industry: input.industry.trim() || null,
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      city: input.city.trim() || null,
      state: input.state.trim() || null,
      timezone: input.timezone.trim() || "Asia/Kolkata",
      currency: input.currency.trim() || "INR",
      highValueThreshold: input.highValueThreshold > 0 ? input.highValueThreshold : 50000,
      defaultPriority: input.defaultPriority,
      lostReasonPresets: input.lostReasonPresets.length ? JSON.stringify(input.lostReasonPresets) : null,
      activeLeadSources: input.activeLeadSources.length ? JSON.stringify(input.activeLeadSources) : null,
      defaultFollowUpDays: input.defaultFollowUpDays > 0 ? input.defaultFollowUpDays : 3,
      staleQuotationDays: input.staleQuotationDays > 0 ? input.staleQuotationDays : 10,
    },
  });

  revalidatePath("/", "layout");
  return {};
}

export type AddTeamMemberResult = { error?: string; password?: string };

/** Wraps the existing team-creation action with a generated temporary password, so onboarding never asks the owner to invent one per teammate. */
export async function addTeamMemberDuringOnboarding(input: {
  name: string;
  email: string;
  role: "SALES_MANAGER" | "SALESPERSON";
}): Promise<AddTeamMemberResult> {
  const password = randomBytes(6).toString("hex");
  const result = await createTeamUser({ name: input.name, email: input.email, password, role: input.role });
  if (result.error) return { error: result.error };
  return { password };
}

export async function completeOnboarding(): Promise<void> {
  const session = await requireSession();
  if (!canManageCompany(session.role)) throw new ForbiddenError("Only the Owner can complete onboarding.");

  await prisma.company.update({ where: { id: session.companyId }, data: { onboardedAt: new Date() } });
  await prisma.auditLog.create({
    data: { companyId: session.companyId, userId: session.userId, action: "ONBOARDING_COMPLETED", entityType: "Company", entityId: session.companyId },
  });

  revalidatePath("/", "layout");
}
