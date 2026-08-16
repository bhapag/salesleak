"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { LeadPriority, LeadSource } from "@/generated/prisma/client";
import { requireSession } from "@/server/auth/session";
import { canManageCompany, ForbiddenError } from "@/server/auth/permissions";

export type CompanySettingsInput = {
  name: string;
  industry: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  timezone: string;
  currency: string;
  highValueThreshold: number;
  staleQuotationDays: number;
  defaultFollowUpDays: number;
  defaultPriority: LeadPriority;
  lostReasonPresets: string[];
  activeLeadSources: LeadSource[];
};

export async function updateCompanySettings(input: CompanySettingsInput): Promise<{ error?: string }> {
  const session = await requireSession();
  if (!canManageCompany(session.role)) throw new ForbiddenError("Only the Owner can change company settings.");

  const name = input.name.trim();
  if (!name) return { error: "Company name is required." };

  const before = await prisma.company.findFirstOrThrow({ where: { id: session.companyId } });

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
      staleQuotationDays: input.staleQuotationDays > 0 ? input.staleQuotationDays : 10,
      defaultFollowUpDays: input.defaultFollowUpDays > 0 ? input.defaultFollowUpDays : 3,
      defaultPriority: input.defaultPriority,
      lostReasonPresets: input.lostReasonPresets.length ? JSON.stringify(input.lostReasonPresets) : null,
      activeLeadSources: input.activeLeadSources.length ? JSON.stringify(input.activeLeadSources) : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: "COMPANY_SETTINGS_CHANGED",
      entityType: "Company",
      entityId: session.companyId,
      metadata: JSON.stringify({ before: { name: before.name, industry: before.industry }, after: { name, industry: input.industry } }),
    },
  });

  revalidatePath("/", "layout");
  return {};
}
