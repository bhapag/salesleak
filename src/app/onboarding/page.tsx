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
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome to SalesLeak</h1>
          <p className="mt-1 text-sm text-slate-500">A few quick steps to set up {company.name}&rsquo;s workspace.</p>
          <p className="mt-2 text-xs text-slate-400">
            by <span className="text-[#B08A45]">NobleArc</span>
          </p>
        </div>
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
    </div>
  );
}
