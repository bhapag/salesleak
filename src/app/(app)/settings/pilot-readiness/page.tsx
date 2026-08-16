import Link from "next/link";
import { requireSession } from "@/server/auth/session";
import { canManageCompany } from "@/server/auth/permissions";
import { NotAuthorized } from "@/components/auth/NotAuthorized";
import { getPilotReadinessReport } from "@/server/data/pilotReadiness";
import { Card } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

export default async function PilotReadinessPage() {
  const session = await requireSession();
  if (!canManageCompany(session.role)) {
    return <NotAuthorized message="Only the Owner can view pilot readiness." />;
  }

  const report = await getPilotReadinessReport(session.companyId);
  const outstanding = report.checks.filter((c) => !c.ok).length;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <h1 className="text-xl font-semibold text-slate-900">Pilot Readiness</h1>
        <p className="text-sm text-slate-500">
          {outstanding === 0
            ? "Setup looks complete — SalesLeak is ready for day-to-day use."
            : `${outstanding} setup item${outstanding === 1 ? "" : "s"} worth a look before relying on SalesLeak day to day.`}
        </p>
      </header>

      <main className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        <Card>
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <div>
              <p className="text-xs text-slate-500">Open opportunities</p>
              <p className="text-2xl font-semibold text-slate-900">{report.openOpportunities.count}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Open opportunity value</p>
              <p className="text-2xl font-semibold text-slate-900">{formatCurrency(report.openOpportunities.value)}</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {report.checks.map((check) => (
            <Card key={check.key}>
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    check.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {check.ok ? "✓" : "!"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{check.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{check.detail}</p>
                  {check.href && (
                    <Link href={check.href} className="mt-1.5 inline-block text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline">
                      {check.ok ? "Review →" : "Fix this →"}
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
