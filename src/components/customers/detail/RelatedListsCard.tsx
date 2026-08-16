import Link from "next/link";
import type { CustomerDetail } from "@/server/data/customers";
import { Card } from "@/components/ui";
import { StatusBadge, QuotationStatusBadge } from "@/components/badges";
import { formatCurrency } from "@/lib/format";
import { getQuotationRisk } from "@/lib/quotationRisk";

export function RelatedListsCard({ customer }: { customer: CustomerDetail }) {
  const allQuotations = customer.leads.flatMap((lead) => lead.quotations.map((q) => ({ ...q, leadTitle: lead.title })));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card title="Leads" description={`${customer.leads.length} total`}>
        {customer.leads.length === 0 ? (
          <p className="text-sm text-slate-500">No leads yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {customer.leads.map((lead) => (
              <li key={lead.id} className="py-2.5">
                <Link href={`/leads/${lead.id}`} className="flex items-center justify-between gap-2 hover:underline">
                  <span className="min-w-0 truncate text-sm text-slate-800">{lead.title}</span>
                  <StatusBadge status={lead.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Quotations" description={`${allQuotations.length} total`}>
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
                      {q.quotationNumber} <span className="text-slate-400">· {formatCurrency(q.value)}</span>
                    </span>
                    <QuotationStatusBadge status={risk.displayStatus} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
