import Link from "next/link";
import type { CustomerDetail } from "@/server/data/customers";
import { Card } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";

export function OpportunitySummaryCard({ customer }: { customer: CustomerDetail }) {
  const items: { label: string; value: React.ReactNode; emphasis?: string }[] = [
    { label: "Total opportunity value", value: formatCurrency(customer.totalOpportunityValue) },
    { label: "Total quotation value", value: formatCurrency(customer.totalQuotationValue) },
    { label: "Won value", value: formatCurrency(customer.totalWonValue), emphasis: "text-emerald-600" },
    { label: "Lost value", value: formatCurrency(customer.totalLostValue), emphasis: customer.totalLostValue > 0 ? "text-red-600" : undefined },
    { label: "Last contact", value: formatDate(customer.lastActivityDate) },
    { label: "Last successful order", value: formatDate(customer.lastWonDate) },
  ];

  return (
    <Card title="Opportunity Summary">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-slate-400">{item.label}</dt>
            <dd className={`text-sm font-medium tabular-nums ${item.emphasis ?? "text-slate-800"}`}>{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">Upcoming next action</p>
        {customer.upcomingNextAction ? (
          <p className="mt-1 text-sm text-slate-800">
            {customer.upcomingNextAction.text}
            {customer.upcomingNextAction.deadline && ` — due ${formatDate(customer.upcomingNextAction.deadline)}`}{" "}
            <Link href={`/leads/${customer.upcomingNextAction.leadId}`} className="text-slate-500 hover:underline">
              (view lead)
            </Link>
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">No upcoming next action on any active opportunity.</p>
        )}
      </div>
    </Card>
  );
}
