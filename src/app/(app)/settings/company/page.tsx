import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import type { LeadSource } from "@/generated/prisma/client";
import { requireSession } from "@/server/auth/session";
import { canManageCompany } from "@/server/auth/permissions";
import { NotAuthorized } from "@/components/auth/NotAuthorized";
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import { ExportDataCard } from "@/components/settings/ExportDataCard";
import { DemoResetCard } from "@/components/settings/DemoResetCard";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Settings" };

export default async function CompanySettingsPage() {
  const session = await requireSession();
  if (!canManageCompany(session.role)) {
    return <NotAuthorized message="Only the Owner can view and change company settings." />;
  }

  const company = await prisma.company.findFirstOrThrow({ where: { id: session.companyId } });

  return (
    <div className="min-h-screen">
      <PageHeader title="Company Settings" subtitle={`Basic workspace information for ${company.name}.`} />

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

          <div className="mt-6">
            <ExportDataCard />
          </div>

          {process.env.NODE_ENV !== "production" && (
            <div className="mt-6">
              <DemoResetCard />
            </div>
          )}

          <p className="mt-8 text-xs text-slate-400">
            SalesLeak is a product of <span className="text-[#B08A45]">NobleArc</span> Technologies.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Questions or need help?{" "}
            <a href="mailto:salesleak.support@gmail.com" className="text-slate-500 underline underline-offset-2 hover:text-slate-700">
              salesleak.support@gmail.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
