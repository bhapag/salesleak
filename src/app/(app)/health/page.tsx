import Link from "next/link";
import { requireSession } from "@/server/auth/session";
import { canManageTeam } from "@/server/auth/permissions";
import { NotAuthorized } from "@/components/auth/NotAuthorized";
import { getSalesHealthReport } from "@/server/data/health";
import { Card } from "@/components/ui";

export default async function HealthPage() {
  const session = await requireSession();
  if (!canManageTeam(session.role)) {
    return <NotAuthorized message="Only the Owner and Sales Managers can view Sales Process Health." />;
  }

  const report = await getSalesHealthReport(session.companyId);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <h1 className="text-xl font-semibold text-slate-900">Sales Process Health</h1>
        <p className="text-sm text-slate-500">
          {report.totalIssues === 0
            ? "No sales-process issues detected."
            : `${report.totalIssues} issue${report.totalIssues === 1 ? "" : "s"} across your sales data — fix what matters most first.`}
        </p>
      </header>

      <main className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        {report.totalIssues === 0 && (
          <Card className="border-emerald-200 bg-emerald-50">
            <p className="text-sm font-medium text-emerald-800">Everything is in good shape.</p>
            <p className="mt-0.5 text-xs text-emerald-700">Every lead, quotation, and customer record checked below is clean.</p>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {report.categories.map((category) => (
            <Card key={category.key} title={category.label} description={category.description}>
              <div className="mb-3 flex items-baseline gap-2">
                <span className={`text-2xl font-semibold ${category.count > 0 ? "text-slate-900" : "text-emerald-600"}`}>{category.count}</span>
                <span className="text-xs text-slate-500">{category.count === 1 ? "record" : "records"}</span>
              </div>

              {category.count === 0 ? (
                <p className="text-xs text-emerald-600">Nothing to fix here.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-slate-100">
                  {category.items.map((item) => (
                    <li key={item.id} className="py-2">
                      <Link href={item.href} className="flex flex-col hover:underline">
                        <span className="truncate text-sm text-slate-800">{item.title}</span>
                        {item.detail && <span className="truncate text-xs text-slate-500">{item.detail}</span>}
                      </Link>
                    </li>
                  ))}
                  {category.count > category.items.length && (
                    <li className="pt-2 text-xs text-slate-400">+{category.count - category.items.length} more</li>
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
