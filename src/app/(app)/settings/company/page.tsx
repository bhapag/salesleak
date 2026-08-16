import { prisma } from "@/lib/prisma";
import type { LeadSource } from "@/generated/prisma/client";
import { requireSession } from "@/server/auth/session";
import { canManageCompany } from "@/server/auth/permissions";
import { NotAuthorized } from "@/components/auth/NotAuthorized";
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import { DemoResetCard } from "@/components/settings/DemoResetCard";
import { Card } from "@/components/ui";

export default async function CompanySettingsPage() {
  const session = await requireSession();
  if (!canManageCompany(session.role)) {
    return <NotAuthorized message="Only the Owner can view and change company settings." />;
  }

  const company = await prisma.company.findFirstOrThrow({ where: { id: session.companyId } });

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <h1 className="text-xl font-semibold text-slate-900">Company Settings</h1>
        <p className="text-sm text-slate-500">Basic workspace information for {company.name}.</p>
      </header>

      <main className="px-4 py-6 sm:px-8">
        <div className="max-w-2xl">
          <Card>
            <CompanySettingsForm
              initial={{
                name: company.name,
                industry: company.industry ?? "",
                phone: company.phone ?? "",
                email: company.email ?? "",
                city: company.city ?? "",
                state: company.state ?? "",
                timezone: company.timezone,
                currency: company.currency,
                highValueThreshold: company.highValueThreshold,
                staleQuotationDays: company.staleQuotationDays,
                defaultFollowUpDays: company.defaultFollowUpDays,
                defaultPriority: company.defaultPriority,
                lostReasonPresets: company.lostReasonPresets ? (JSON.parse(company.lostReasonPresets) as string[]) : [],
                activeLeadSources: company.activeLeadSources ? (JSON.parse(company.activeLeadSources) as LeadSource[]) : [],
              }}
            />
          </Card>

          {process.env.NODE_ENV !== "production" && (
            <div className="mt-6">
              <DemoResetCard />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
