import Link from "next/link";
import { notFound } from "next/navigation";
import { getSalespersonDetail } from "@/server/data/team";
import { StatusBadge } from "@/components/badges";
import { formatCurrency, formatDate, formatDateTime, labelize } from "@/lib/format";
import { TASK_BUCKET_LABEL } from "@/lib/taskRisk";
import { requireSession } from "@/server/auth/session";
import { canManageTeam } from "@/server/auth/permissions";
import { NotAuthorized } from "@/components/auth/NotAuthorized";

export default async function SalespersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canManageTeam(session.role)) {
    return <NotAuthorized message="Team visibility is limited to the Owner and Sales Managers." />;
  }

  const detail = await getSalespersonDetail(session.companyId, id);
  if (!detail) notFound();

  return <SalespersonDetailBody detail={detail} />;
}

function SalespersonDetailBody({ detail }: { detail: NonNullable<Awaited<ReturnType<typeof getSalespersonDetail>>> }) {
  const { user, needsAttention, activeLeads, wonOpportunities, openQuotations, overdueQuotations, today, overdueTasks, upcoming, recentActivities, moneyAtRisk } = detail;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <Link href="/team" className="text-sm font-medium text-slate-500 transition-colors duration-(--dur-micro) hover:text-slate-900">
          ← Back to Team
        </Link>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{user.name}</h1>
            <p className="text-sm text-slate-500">
              {labelize(user.role)}
              {!user.isActive && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                  Inactive
                </span>
              )}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-right">
            <p className="text-xs text-slate-400">Money at risk</p>
            <p className={`text-lg font-semibold tabular-nums ${moneyAtRisk > 0 ? "text-red-600" : "text-slate-900"}`}>
              {formatCurrency(moneyAtRisk)}
            </p>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        <Section title="Needs Attention" description="Leads and quotations that need this salesperson's attention right now.">
          {needsAttention.length === 0 ? (
            <EmptyRow text="Nothing needs attention — every active lead and open quotation is on track." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {needsAttention.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={item.href}
                    className="flex flex-col gap-1 px-5 py-3 transition-colors duration-(--dur-micro) hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end">
                      <span className={`text-xs font-medium ${item.severity === "critical" ? "text-red-600" : "text-amber-700"}`}>
                        {item.urgencyLabel}
                      </span>
                      <span className="text-sm font-medium tabular-nums text-slate-700 sm:w-24 sm:text-right">{formatCurrency(item.amount)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {overdueTasks.length > 0 && (
          <Section title="Overdue" description={`${overdueTasks.length} follow-up${overdueTasks.length === 1 ? "" : "s"} past due`}>
            <TaskList tasks={overdueTasks} empty="" overdue />
          </Section>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Today" description={`${today.length} follow-up${today.length === 1 ? "" : "s"} due today`}>
            <TaskList tasks={today} empty="Nothing due today." />
          </Section>
          <Section title="Upcoming" description={`${upcoming.length} scheduled`}>
            <TaskList tasks={upcoming} empty="No upcoming follow-ups scheduled." />
          </Section>
        </div>

        <Section title="Open Opportunities" description={`${activeLeads.length} active leads`}>
          {activeLeads.length === 0 ? (
            <EmptyRow text="No active leads assigned." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {activeLeads.map((lead) => (
                <li key={lead.id}>
                  <Link href={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-(--dur-micro) hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-800">{lead.title}</p>
                      <p className="text-xs text-slate-400">{lead.customer.name}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={lead.status} />
                      <span className="text-sm font-medium tabular-nums text-slate-700">{formatCurrency(lead.estimatedValue)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Open Quotations" description={`${openQuotations.length} open`}>
            {openQuotations.length === 0 ? (
              <EmptyRow text="No open quotations." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {openQuotations.map((q) => (
                  <li key={q.id}>
                    <Link href={`/quotations/${q.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-(--dur-micro) hover:bg-slate-50">
                      <span className="min-w-0 truncate text-sm text-slate-800">
                        {q.quotationNumber} <span className="text-slate-400">· {q.lead.customer.name}</span>
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-slate-700">{formatCurrency(q.value)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Won Opportunities" description={`${wonOpportunities.length} won`}>
            {wonOpportunities.length === 0 ? (
              <EmptyRow text="No won deals yet." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {wonOpportunities.map((lead) => (
                  <li key={lead.id}>
                    <Link href={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-(--dur-micro) hover:bg-slate-50">
                      <span className="min-w-0 truncate text-sm text-slate-800">{lead.title}</span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-emerald-600">{formatCurrency(lead.estimatedValue)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {overdueQuotations.length > 0 && (
          <Section title="Overdue Quotations" description={`${overdueQuotations.length} awaiting follow-up`}>
            <ul className="divide-y divide-slate-100">
              {overdueQuotations.map((q) => (
                <li key={q.id}>
                  <Link href={`/quotations/${q.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-(--dur-micro) hover:bg-slate-50">
                    <span className="min-w-0 truncate text-sm text-slate-800">
                      {q.quotationNumber} <span className="text-slate-400">· {q.lead.customer.name}</span>
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-red-600">{formatCurrency(q.value)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Recent Activity" description="Latest calls, notes, and status changes logged by this salesperson">
          {recentActivities.length === 0 ? (
            <EmptyRow text="No activity logged yet." />
          ) : (
            <ul className="flex flex-col gap-3 px-5 py-4">
              {recentActivities.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                  <div className="min-w-0">
                    <Link href={`/leads/${a.leadId}`} className="text-sm text-slate-800 hover:underline">
                      {a.notes}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {labelize(a.type)} · {a.lead.customer.name} · {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </main>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="px-5 py-8 text-center text-sm text-slate-500">{text}</div>;
}

type TaskWithLead = {
  id: string;
  title: string;
  dueDate: Date;
  lead: { id: string; title: string; customer: { name: string } };
  risk: { bucket: keyof typeof TASK_BUCKET_LABEL; daysOverdue: number };
};

function TaskList({ tasks, empty, overdue }: { tasks: TaskWithLead[]; empty: string; overdue?: boolean }) {
  if (tasks.length === 0) return <EmptyRow text={empty} />;
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link href={`/leads/${task.lead.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-(--dur-micro) hover:bg-slate-50">
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-800">{task.title}</p>
              <p className="text-xs text-slate-400">{task.lead.customer.name}</p>
            </div>
            <span className={`shrink-0 text-xs font-medium tabular-nums ${overdue ? "text-red-600" : "text-slate-500"}`}>
              {overdue ? `${task.risk.daysOverdue}d overdue` : formatDate(task.dueDate)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
