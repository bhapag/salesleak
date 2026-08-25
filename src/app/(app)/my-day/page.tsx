import Link from "next/link";
import type { Metadata } from "next";
import { getMyDayData } from "@/server/data/myDay";
import { TaskActionsCard } from "@/components/tasks/TaskActionsCard";
import { StatusBadge, QuotationStatusBadge, RepeatOrderBadge } from "@/components/badges";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "My Day" };

export default async function MyDayPage() {
  const session = await requireSession();
  const data = await getMyDayData(session.companyId, session.userId);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-6 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My Day</h1>
        <p className="text-sm text-slate-500">{session.name}</p>
      </header>

      <main className="flex flex-col gap-6 px-4 py-6 sm:px-8">
        <Section title="Overdue" tone="red" count={data.overdueTasks.length} emptyText="No overdue follow-ups. Nice work.">
          {data.overdueTasks.map((task) => (
            <TaskActionsCard key={task.id} task={task} actingUserId={session.userId} />
          ))}
        </Section>

        <Section title="Due Today" tone="amber" count={data.dueToday.length} emptyText="Nothing due today.">
          {data.dueToday.map((task) => (
            <TaskActionsCard key={task.id} task={task} actingUserId={session.userId} />
          ))}
        </Section>

        {data.upcoming.length > 0 && (
          <Section title="Upcoming" tone="slate" count={data.upcoming.length} emptyText="">
            {data.upcoming.map((task) => (
              <TaskActionsCard key={task.id} task={task} actingUserId={session.userId} />
            ))}
          </Section>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ListCard title="New Enquiries" count={data.newEnquiries.length} emptyText="No new enquiries assigned to you.">
            {data.newEnquiries.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-(--dur-micro) hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">{lead.title}</p>
                  <p className="text-xs text-slate-400">{lead.customer.name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={lead.status} />
                  <span className="text-sm font-medium tabular-nums text-slate-700">{formatCurrency(lead.estimatedValue)}</span>
                </div>
              </Link>
            ))}
          </ListCard>

          <ListCard title="Quotations Needing Follow-up" count={data.quotationsNeedingFollowUp.length} emptyText="No quotations need follow-up.">
            {data.quotationsNeedingFollowUp.map((q) => (
              <Link
                key={q.id}
                href={`/quotations/${q.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-(--dur-micro) hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">
                    {q.quotationNumber} <span className="text-slate-400">· {q.lead.customer.name}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <QuotationStatusBadge status={q.risk.displayStatus} />
                  <span className="text-sm font-medium tabular-nums text-slate-700">{formatCurrency(q.value)}</span>
                </div>
              </Link>
            ))}
          </ListCard>

          <ListCard title="High-Value Opportunities" count={data.highValueAttention.length} emptyText="No high-value opportunities need attention.">
            {data.highValueAttention.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-(--dur-micro) hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">{lead.title}</p>
                  <p className="text-xs text-slate-400">{lead.customer.name}</p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-red-600">{formatCurrency(lead.estimatedValue)}</span>
              </Link>
            ))}
          </ListCard>

          <ListCard
            title="Repeat-Order Opportunities"
            count={data.repeatOrderOpportunities.length}
            emptyText="No repeat-order opportunities assigned to you."
          >
            {data.repeatOrderOpportunities.map((customer) => (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-(--dur-micro) hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">{customer.name}</p>
                  <p className="text-xs text-slate-400">
                    {customer.repeatOrderSignal.lastOrderDate && `Last order ${formatDate(customer.repeatOrderSignal.lastOrderDate)}`}
                  </p>
                </div>
                <RepeatOrderBadge eligible={customer.repeatOrderSignal.eligible} status={customer.repeatOrderSignal.status} />
              </Link>
            ))}
          </ListCard>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  tone,
  count,
  emptyText,
  children,
}: {
  title: string;
  tone: "red" | "amber" | "slate";
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  const toneClass = tone === "red" ? "bg-red-100 text-red-700" : tone === "amber" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${toneClass}`}>
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="flex flex-col gap-3">{children}</div>
      )}
    </div>
  );
}

function ListCard({ title, count, emptyText, children }: { title: string; count: number; emptyText: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className="text-xs tabular-nums text-slate-400">{count}</span>
      </div>
      {count === 0 ? <div className="px-5 py-8 text-center text-sm text-slate-500">{emptyText}</div> : <div className="divide-y divide-slate-100">{children}</div>}
    </div>
  );
}
