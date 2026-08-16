import Link from "next/link";
import { getDashboardData } from "@/server/data/metrics";
import { getCachedInsight } from "@/server/data/ai";
import { formatCurrency } from "@/lib/format";
import { requireSession } from "@/server/auth/session";
import { getOwnerScope } from "@/server/auth/permissions";
import { AiSalesBrief, type SalesBriefData } from "@/components/ai/AiSalesBrief";
import type { SalesBriefResult } from "@/server/ai/features/salesBrief";

export default async function Home() {
  const session = await requireSession();
  const ownerScope = getOwnerScope(session);

  const [{ stats, moneyAtRisk, attentionItems, teamSnapshot, repeatOpportunities, workToday }, cachedBrief] = await Promise.all([
    getDashboardData(session.companyId, session.userId, ownerScope),
    getCachedInsight(session.companyId, "SALES_BRIEF", "Company", session.companyId),
  ]);

  const initialBrief: SalesBriefData | null = cachedBrief
    ? { ...(JSON.parse(cachedBrief.content) as SalesBriefResult), mocked: cachedBrief.mocked, generatedAt: cachedBrief.updatedAt }
    : null;

  const statCards = [
    { label: "New Enquiries", value: stats.newEnquiries },
    { label: "Uncontacted Enquiries", value: stats.uncontactedEnquiries, alert: stats.uncontactedEnquiries > 0 },
    { label: "Follow-ups Due Today", value: stats.followUpsDueToday },
    { label: "Overdue Follow-ups", value: stats.overdueFollowUps, alert: stats.overdueFollowUps > 0 },
    { label: "Open Quotation Value", value: formatCurrency(stats.openQuotationValue) },
    { label: "Quotation Value Overdue", value: formatCurrency(stats.quotationValueOverdue), alert: stats.quotationValueOverdue > 0 },
    { label: "Opportunities w/o Next Action", value: stats.opportunitiesWithoutNextAction, alert: stats.opportunitiesWithoutNextAction > 0 },
    { label: "Won Value", value: formatCurrency(stats.wonValue) },
  ];

  const moneyRows = [
    { label: "Overdue quotation follow-ups", count: moneyAtRisk.overdueQuotationCount, value: moneyAtRisk.overdueQuotationValue, href: "/quotations" },
    { label: "Uncontacted leads", count: moneyAtRisk.uncontactedLeadCount, value: moneyAtRisk.uncontactedLeadValue, href: "/leads" },
    { label: "Opportunities missing a next action", count: moneyAtRisk.missingNextActionCount, value: moneyAtRisk.missingNextActionValue, href: "/leads" },
    { label: "Quotations with no recent activity", count: moneyAtRisk.staleQuotationCount, value: moneyAtRisk.staleQuotationValue, href: "/quotations" },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">{session.companyName}</p>
      </header>

      <main className="flex flex-col gap-6 px-4 py-8 sm:px-8">
        {/* Quick links: today's work, notifications, and (Owner/Sales Manager only) team workload */}
        <div className={`grid grid-cols-2 gap-3 ${ownerScope ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
          <Link href="/my-day" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300">
            <p className="text-xs text-slate-500">Today&apos;s Work</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{workToday.todaysWorkCount}</p>
          </Link>
          <Link href="/tasks" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300">
            <p className="text-xs text-slate-500">{ownerScope ? "Overdue Follow-ups" : "Overdue Across Team"}</p>
            <p className={`mt-0.5 text-lg font-semibold ${workToday.teamOverdueCount > 0 ? "text-red-600" : "text-slate-900"}`}>
              {workToday.teamOverdueCount}
            </p>
          </Link>
          {!ownerScope && (
            <Link href="/team" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300">
              <p className="text-xs text-slate-500">Team Workload</p>
              <p className="mt-0.5 text-lg font-semibold text-slate-900">{teamSnapshot.length} people →</p>
            </Link>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs text-slate-500">Unread Notifications</p>
            <p className={`mt-0.5 text-lg font-semibold ${workToday.unreadNotificationCount > 0 ? "text-blue-600" : "text-slate-900"}`}>
              {workToday.unreadNotificationCount}
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${s.alert ? "text-red-600" : "text-slate-900"}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* MONEY AT RISK */}
        <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-white shadow-sm">
          <div className="border-b border-red-100 px-5 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-red-700">Money at Risk</h2>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{formatCurrency(moneyAtRisk.totalAtRiskValue)}</p>
            <p className="mt-1 text-sm text-slate-500">Revenue tied to leads or quotations that need action right now.</p>
          </div>
          <div className="grid grid-cols-1 divide-y divide-red-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {moneyRows.map((row) => (
              <Link key={row.label} href={row.href} className="flex flex-col gap-1 px-5 py-4 hover:bg-red-50/60">
                <p className="text-xs text-slate-500">{row.label}</p>
                <p className="text-lg font-semibold text-slate-900">{formatCurrency(row.value)}</p>
                <p className="text-xs text-slate-400">
                  {row.count} {row.count === 1 ? "item" : "items"}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* AI SALES BRIEF */}
        <AiSalesBrief initial={initialBrief} />

        {/* ATTENTION REQUIRED */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Attention Required</h2>
              <p className="text-xs text-slate-500">The most urgent leads and quotations, ranked by severity and value.</p>
            </div>
          </div>

          {attentionItems.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              Nothing needs attention right now — every active lead and open quotation is on track.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attentionItems.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link href={item.href} className="flex flex-col gap-2 px-5 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.severity === "critical" ? "bg-red-500" : "bg-amber-500"}`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pl-5 sm:pl-0 sm:justify-end">
                      <span className={`text-xs font-medium ${item.severity === "critical" ? "text-red-600" : "text-amber-700"}`}>
                        {item.urgencyLabel}
                      </span>
                      <span className="text-sm font-medium text-slate-700 sm:w-24 sm:text-right">{formatCurrency(item.amount)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* REPEAT REVENUE OPPORTUNITIES */}
        {repeatOpportunities.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Repeat Revenue Opportunities</h2>
              <p className="text-xs text-slate-500">
                Customers who may be due for another order, based on their past ordering pattern — an estimate, not a guarantee.
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {repeatOpportunities.map((op) => (
                <li key={op.customerId}>
                  <Link
                    href={`/customers/${op.customerId}`}
                    className="flex flex-col gap-2 px-5 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{op.customerName}</p>
                      <p className="text-xs text-slate-500">
                        {op.suggestedAction} · {op.assignedSalesperson ?? "Unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end">
                      <span
                        className={`text-xs font-medium ${op.status === "Overdue / Dormant" ? "text-red-600" : op.status === "Repeat Order Due" ? "text-amber-700" : "text-sky-700"}`}
                      >
                        {op.status}
                        {op.lastOrderDate && ` · last order ${op.lastOrderDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                      </span>
                      <span className="text-sm font-medium text-slate-700 sm:w-24 sm:text-right">{formatCurrency(op.estimatedValue)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* TEAM SNAPSHOT — Owner/Sales Manager only, matching /team's own access rule */}
        {!ownerScope && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Team Snapshot</h2>
              <p className="text-xs text-slate-500">Where each salesperson stands right now.</p>
            </div>
            <Link href="/team" className="text-sm font-medium text-slate-900 hover:underline">
              Full team page →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Salesperson</th>
                  <th className="px-5 py-3 font-medium">Active Leads</th>
                  <th className="px-5 py-3 font-medium">Overdue Follow-ups</th>
                  <th className="px-5 py-3 font-medium">Open Quotation Value</th>
                  <th className="px-5 py-3 font-medium">Won Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamSnapshot.map((row) => (
                  <tr key={row.userId} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      <Link href={`/team/${row.userId}`} className="hover:underline">
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{row.activeLeads}</td>
                    <td className={`px-5 py-3 ${row.overdueFollowUps > 0 ? "font-medium text-red-600" : "text-slate-600"}`}>
                      {row.overdueFollowUps}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatCurrency(row.openQuotationValue)}</td>
                    <td className="px-5 py-3 font-medium text-emerald-600">{formatCurrency(row.wonValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
