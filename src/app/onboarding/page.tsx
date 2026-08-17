import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const session = await requireSession();
  if (session.role !== "OWNER") redirect("/");

  const company = await prisma.company.findFirstOrThrow({ where: { id: session.companyId } });
  if (company.onboardedAt) redirect("/");

  return (
    <div className="min-h-screen bg-brand-warm-white px-4 py-10 sm:px-8">
      <OnboardingWizard
        company={{
          name: company.name,
          industry: company.industry ?? "",
          phone: company.phone ?? "",
          email: company.email ?? "",
          city: company.city ?? "",
          state: company.state ?? "",
          timezone: company.timezone,
          currency: company.currency,
          highValueThreshold: company.highValueThreshold,
          defaultFollowUpDays: company.defaultFollowUpDays,
          staleQuotationDays: company.staleQuotationDays,
          defaultPriority: company.defaultPriority,
        }}
      />
    </div>
  );
}
