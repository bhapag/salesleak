import Link from "next/link";
import type { CustomerDetail } from "@/server/data/customers";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

// Lost is deliberately neutral, not red — a closed-lost deal is a settled
// historical outcome, not an active risk (same rule as everywhere else Lost
// appears in SalesLeak: see badges.tsx and quotations/detail/CloseDealCard).
const kindStyle: Record<string, string> = {
  enquiry: "bg-blue-500",
  quotation: "bg-amber-500",
  won: "bg-emerald-500",
  lost: "bg-slate-400",
  activity: "bg-slate-400",
};

export function CustomerTimeline({ customer }: { customer: CustomerDetail }) {
  return (
    <Card title="History" description="Every enquiry, quotation, follow-up, and outcome for this customer, newest first">
      {customer.timeline.length === 0 ? (
        <p className="text-sm text-slate-500">No history yet — this customer&apos;s enquiries, quotations, and outcomes will appear here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-50 border-t border-slate-100">
          {customer.timeline.map((entry) => (
            <li key={entry.id} className="flex gap-3 py-3 first:pt-4">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${kindStyle[entry.kind] ?? "bg-slate-400"}`} aria-hidden="true" />
              <div className="min-w-0">
                <Link href={entry.href} className="text-sm text-slate-800 hover:underline">
                  {entry.title}
                </Link>
                <p className="mt-0.5 text-xs text-slate-400">
                  {entry.subtitle ? `${entry.subtitle} · ` : ""}
                  {formatDateTime(entry.date)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
