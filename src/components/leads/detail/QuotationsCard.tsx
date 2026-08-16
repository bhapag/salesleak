import type { LeadDetail } from "@/server/data/leads";
import { Card } from "@/components/ui";
import { formatCurrency, formatDate, labelize } from "@/lib/format";

const statusStyle: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-200",
  SENT: "bg-amber-50 text-amber-700 ring-amber-200",
  FOLLOWED_UP: "bg-blue-50 text-blue-700 ring-blue-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-red-50 text-red-700 ring-red-200",
  EXPIRED: "bg-slate-100 text-slate-400 ring-slate-200",
};

export function QuotationsCard({ lead }: { lead: LeadDetail }) {
  return (
    <Card title="Quotations" description="Quotations sent for this opportunity">
      {lead.quotations.length === 0 ? (
        <p className="text-sm text-slate-500">No quotations sent yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {lead.quotations.map((q) => (
            <div key={q.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{q.quotationNumber}</p>
                <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusStyle[q.status]}`}>
                  {labelize(q.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{formatCurrency(q.value)}</p>
              <p className="mt-1 text-xs text-slate-400">
                Sent {formatDate(q.sentAt)}
                {q.validUntil && ` · Valid until ${formatDate(q.validUntil)}`}
                {q.followUpDate && ` · Follow up ${formatDate(q.followUpDate)}`}
              </p>
              {q.items.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
                  {q.items.map((item) => (
                    <li key={item.id} className="flex justify-between">
                      <span>
                        {item.description} × {item.quantity}
                      </span>
                      <span>{formatCurrency(item.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
