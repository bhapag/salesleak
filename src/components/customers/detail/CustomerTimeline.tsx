import Link from "next/link";
import type { CustomerDetail } from "@/server/data/customers";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

const kindStyle: Record<string, string> = {
  enquiry: "bg-blue-500",
  quotation: "bg-amber-500",
  won: "bg-emerald-500",
  lost: "bg-red-500",
  activity: "bg-slate-400",
};

export function CustomerTimeline({ customer }: { customer: CustomerDetail }) {
  return (
    <Card title="History" description="Every enquiry, quotation, follow-up, and outcome for this customer, newest first">
      {customer.timeline.length === 0 ? (
        <p className="text-sm text-slate-500">No history yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {customer.timeline.map((entry) => (
            <li key={entry.id} className="flex gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${kindStyle[entry.kind] ?? "bg-slate-400"}`} />
              <div className="min-w-0">
                <Link href={entry.href} className="text-sm text-slate-800 hover:underline">
                  {entry.title}
                </Link>
                <p className="text-xs text-slate-400">
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
