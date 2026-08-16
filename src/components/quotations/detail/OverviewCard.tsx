import Link from "next/link";
import type { QuotationDetail } from "@/server/data/quotations";
import { Card } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

export function OverviewCard({ quotation }: { quotation: QuotationDetail }) {
  return (
    <Card title="Overview" description={quotation.quotationNumber}>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-400">Customer</dt>
          <dd className="text-sm text-slate-800">{quotation.lead.customer.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Linked lead</dt>
          <dd className="text-sm text-slate-800">
            <Link href={`/leads/${quotation.leadId}`} className="hover:underline">
              {quotation.lead.title}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Salesperson</dt>
          <dd className="text-sm text-slate-800">{quotation.lead.owner?.name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Total amount</dt>
          <dd className="text-sm font-medium text-slate-800">{formatCurrency(quotation.value)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Created</dt>
          <dd className="text-sm text-slate-800">{formatDate(quotation.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Sent</dt>
          <dd className="text-sm text-slate-800">{quotation.sentAt ? formatDate(quotation.sentAt) : "Not sent yet"}</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs text-slate-400">Products</p>
        {quotation.items.length === 0 ? (
          <p className="text-sm text-slate-500">No line items recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Product</th>
                  <th className="py-1.5 pr-3 font-medium">Qty</th>
                  <th className="py-1.5 pr-3 font-medium">Unit Price</th>
                  <th className="py-1.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotation.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1.5 pr-3 text-slate-700">{item.description}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{item.quantity}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-1.5 text-right text-slate-700">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {quotation.status === "REJECTED" && quotation.lostReason && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2">
          <p className="text-xs font-medium text-red-700">Lost reason</p>
          <p className="text-sm text-red-800">{quotation.lostReason}</p>
        </div>
      )}
    </Card>
  );
}
