import Link from "next/link";
import type { CustomerDetail } from "@/server/data/customers";
import { Card } from "@/components/ui";
import { StatusBadge, QuotationStatusBadge } from "@/components/badges";
import { formatCurrency, formatDate } from "@/lib/format";
import { getQuotationRisk } from "@/lib/quotationRisk";

export function RelatedListsCard({ customer }: { customer: CustomerDetail }) {
  const now = new Date();
  const openLeads = customer.leads.filter((lead) => lead.status !== "WON" && lead.status !== "LOST");
  const allQuotations = customer.leads
    .flatMap((lead) => lead.quotations.map((q) => ({ ...q, leadTitle: lead.title })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card title="Open Opportunities" description={`${openLeads.length} active`}>
        {openLeads.length === 0 ? (
          <p className="text-sm text-slate-500">
            No open opportunities right now — closed leads still show up in the history below.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {openLeads.map((lead) => {
              const isOverdue = lead.nextActionDeadline != null && lead.nextActionDeadline < now;
              return (
                <li key={lead.id} className="flex flex-col gap-1 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1 truncate text-sm text-slate-800 hover:underline">
                      {lead.title}
                    </Link>
                    <StatusBadge status={lead.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span>{lead.owner ? lead.owner.name : <span className="font-medium text-amber-700">Unassigned</span>}</span>
                    {lead.estimatedValue != null && <span className="tabular-nums">{formatCurrency(lead.estimatedValue)}</span>}
                    <span className={isOverdue ? "font-medium text-red-600" : undefined}>
                      {lead.nextAction ?? "No next action"}
                      {lead.nextActionDeadline && ` — ${isOverdue ? "overdue" : "due"} ${formatDate(lead.nextActionDeadline)}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Quotation History" description={`${allQuotations.length} total`}>
        {allQuotations.length === 0 ? (
          <p className="text-sm text-slate-500">No quotations yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {allQuotations.map((q) => {
              const risk = getQuotationRisk({
                status: q.status,
                value: q.value,
                sentAt: q.sentAt,
                followUpDate: q.followUpDate,
                nextAction: q.nextAction,
                updatedAt: q.updatedAt,
              });
              return (
                <li key={q.id} className="py-2.5">
                  <Link href={`/quotations/${q.id}`} className="flex items-center justify-between gap-2 hover:underline">
                    <span className="min-w-0 truncate text-sm text-slate-800">
                      {q.quotationNumber} <span className="tabular-nums text-slate-400">· {formatCurrency(q.value)}</span>
                    </span>
                    <QuotationStatusBadge status={risk.displayStatus} />
                  </Link>
                  <p className="mt-0.5 text-xs tabular-nums text-slate-400">{formatDate(q.sentAt ?? q.createdAt)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
