import { redirect } from "next/navigation";
import Image from "next/image";
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
          <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-2xl shadow-sm">
            <Image
              src="/brand/salesleak/salesleak-master-dark.png"
              alt="SalesLeak by NobleArc"
              width={1774}
              height={887}
              priority
              sizes="260px"
              className="h-auto w-full"
            />
          </div>
          <p className="mt-3 text-sm text-slate-500">Welcome — a few quick steps to set up {company.name}&rsquo;s workspace.</p>
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
