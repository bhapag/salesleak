import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "@/server/auth/session";
import { canManageTeam } from "@/server/auth/permissions";
import { NotAuthorized } from "@/components/auth/NotAuthorized";
import { getSalesHealthReport } from "@/server/data/health";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Health" };

export default async function HealthPage() {
  const session = await requireSession();
  if (!canManageTeam(session.role)) {
    return <NotAuthorized message="Only the Owner and Sales Managers can view Sales Process Health." />;
  }

  const report = await getSalesHealthReport(session.companyId);
  const healthy = report.totalIssues === 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sales Process Health</h1>
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
              healthy ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"
            }`}
          >
            {healthy ? "Healthy" : `${report.totalIssues} to review`}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {healthy
            ? "No sales-process issues detected."
            : `${report.totalIssues} issue${report.totalIssues === 1 ? "" : "s"} across your sales data — fix what matters most first.`}
        </p>
      </header>

      <main className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        {healthy && (
          <Card className="border-emerald-200 bg-emerald-50">
            <p className="text-sm font-medium text-emerald-800">Everything is in good shape.</p>
            <p className="mt-0.5 text-xs text-emerald-700">Every lead, quotation, and customer record checked below is clean.</p>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {report.categories.map((category) => (
            <Card
              key={category.key}
              title={category.label}
              description={category.description}
              className={`border-l-[3px] ${category.count > 0 ? "border-l-amber-400" : "border-l-transparent"}`}
            >
              <div className="mb-3 flex items-baseline gap-2">
                <span className={`text-2xl font-semibold tabular-nums ${category.count > 0 ? "text-amber-700" : "text-emerald-600"}`}>
                  {category.count}
                </span>
                <span className="text-xs text-slate-500">{category.count === 1 ? "record" : "records"}</span>
              </div>

              {category.count === 0 ? (
                <p className="text-sm text-emerald-600">Nothing to fix here.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-slate-100">
                  {category.items.map((item) => (
                    <li key={item.id} className="py-2">
                      <Link href={item.href} className="flex flex-col transition-colors duration-(--dur-micro) hover:underline">
                        <span className="truncate text-sm text-slate-800">{item.title}</span>
                        {item.detail && <span className="truncate text-xs text-slate-500">{item.detail}</span>}
                      </Link>
                    </li>
                  ))}
                  {category.count > category.items.length && (
                    <li className="pt-2 text-xs tabular-nums text-slate-400">+{category.count - category.items.length} more</li>
                  )}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
