import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getTeamOverview, type TeamOverviewRow } from "@/server/data/team";
import { formatCurrency, labelize } from "@/lib/format";
import { requireSession } from "@/server/auth/session";
import { canManageTeam, canManageCompany } from "@/server/auth/permissions";
import { NotAuthorized } from "@/components/auth/NotAuthorized";
import { ManageTeamCard } from "@/components/team/ManageTeamCard";

// A left rail, not a row wash — same pattern as Leads/Quotations/Customers.
// Overdue follow-ups is the genuine red signal; missing-next-action or at-risk
// quotation value is the amber attention signal; a clean row stays plain.
function teamRiskRailClass(row: TeamOverviewRow): string {
  if (row.overdueFollowUps > 0) return "border-l-[3px] border-l-red-500";
  if (row.leadsMissingNextAction > 0 || row.quotationValueAtRisk > 0) return "border-l-[3px] border-l-amber-400";
  return "border-l-[3px] border-l-transparent";
}

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const session = await requireSession();
  if (!canManageTeam(session.role)) {
    return <NotAuthorized message="Team visibility is limited to the Owner and Sales Managers." />;
  }

  const isOwner = canManageCompany(session.role);
  const [rows, allUsers] = await Promise.all([
    getTeamOverview(session.companyId),
    isOwner ? prisma.user.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const sorted = [...rows].sort((a, b) => b.overdueFollowUps - a.overdueFollowUps || b.quotationValueAtRisk - a.quotationValueAtRisk);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-6 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Team</h1>
        <p className="text-sm text-slate-500">Where each salesperson stands — accountability, not surveillance.</p>
      </header>

      <main className="flex flex-col gap-6 px-4 py-6 sm:px-8">
        {isOwner && (
          <ManageTeamCard
            users={allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive }))}
            currentUserId={session.userId}
          />
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[1300px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Salesperson</th>
                <th className="px-4 py-3 text-right">Active Leads</th>
                <th className="px-4 py-3 text-right">New Leads</th>
                <th className="px-4 py-3 text-right">Due Today</th>
                <th className="px-4 py-3 text-right">Overdue Follow-ups</th>
                <th className="px-4 py-3 text-right">Missing Next Action</th>
                <th className="px-4 py-3 text-right">Open Quotation Value</th>
                <th className="px-4 py-3 text-right">Quotation Value at Risk</th>
                <th className="px-4 py-3 text-right">Won Deals</th>
                <th className="px-4 py-3 text-right">Won Value</th>
                <th className="px-4 py-3 text-right">Upcoming Tasks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((row) => (
                <tr
                  key={row.userId}
                  className={`cursor-pointer transition-colors duration-(--dur-micro) hover:bg-slate-50 ${teamRiskRailClass(row)}`}
                >
                  <td className="px-4 py-3">
                    <Link href={`/team/${row.userId}`} className="block">
                      <span className={`font-medium hover:underline ${row.isActive ? "text-slate-900" : "text-slate-400"}`}>{row.name}</span>
                      {!row.isActive && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                          Inactive
                        </span>
                      )}
                      <p className="text-xs text-slate-400">{labelize(row.role)}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    <Link href={`/team/${row.userId}`}>{row.activeLeads}</Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    <Link href={`/team/${row.userId}`}>{row.newLeads}</Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    <Link href={`/team/${row.userId}`}>{row.followUpsDueToday}</Link>
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${row.overdueFollowUps > 0 ? "font-medium text-red-600" : "text-slate-600"}`}>
                    <Link href={`/team/${row.userId}`}>{row.overdueFollowUps}</Link>
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${row.leadsMissingNextAction > 0 ? "font-medium text-amber-700" : "text-slate-600"}`}
                  >
                    <Link href={`/team/${row.userId}`}>{row.leadsMissingNextAction}</Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    <Link href={`/team/${row.userId}`}>{formatCurrency(row.openQuotationValue)}</Link>
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${row.quotationValueAtRisk > 0 ? "font-medium text-red-600" : "text-slate-600"}`}>
                    <Link href={`/team/${row.userId}`}>{formatCurrency(row.quotationValueAtRisk)}</Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    <Link href={`/team/${row.userId}`}>{row.wonDeals}</Link>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-600">
                    <Link href={`/team/${row.userId}`}>{formatCurrency(row.wonValue)}</Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    <Link href={`/team/${row.userId}`}>{row.upcomingTasks}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
