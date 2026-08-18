import type { CustomerDetail } from "@/server/data/customers";
import { Card } from "@/components/ui";
import { RepeatOrderBadge } from "@/components/badges";
import { formatCurrency, formatDate } from "@/lib/format";

// Derived purely from the two numbers the signal already exposes
// (lastOrderDate + averageIntervalDays) — not a new metric, just a plainer
// way of saying the same thing the "days since last order" figure implies.
function nextExpectedDate(lastOrderDate: Date, averageIntervalDays: number): Date {
  return new Date(lastOrderDate.getTime() + averageIntervalDays * 24 * 60 * 60 * 1000);
}

function repeatOrderPhrase(nextExpected: Date, now: Date): string {
  const daysUntil = Math.round((nextExpected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return `Repeat order overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"}`;
  if (daysUntil === 0) return "Repeat order expected today";
  return `Repeat order expected in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
}

export function RepeatOrderCard({ customer }: { customer: CustomerDetail }) {
  const signal = customer.repeatOrderSignal;
  const now = new Date();
  const nextExpected =
    signal.eligible && signal.lastOrderDate && signal.averageIntervalDays != null
      ? nextExpectedDate(signal.lastOrderDate, signal.averageIntervalDays)
      : null;

  return (
    <Card title="Repeat-Order Signal" description="A rule-based estimate from order history — not a guarantee.">
      {!signal.eligible ? (
        <p className="text-sm text-slate-500">
          {signal.wonOrderCount === 0
            ? "No won orders yet, so there's no purchase pattern to estimate from."
            : "Only one won order so far — need at least two to estimate a reorder cadence."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <RepeatOrderBadge eligible={signal.eligible} status={signal.status} />
            {nextExpected && (
              <p
                className={`text-sm font-medium ${
                  signal.status === "Overdue / Dormant"
                    ? "text-red-600"
                    : signal.status === "Repeat Order Due"
                      ? "text-amber-700"
                      : "text-slate-600"
                }`}
              >
                {repeatOrderPhrase(nextExpected, now)}
              </p>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-400">Won orders</dt>
              <dd className="text-sm font-medium tabular-nums text-slate-800">{signal.wonOrderCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Avg. time between orders</dt>
              <dd className="text-sm font-medium tabular-nums text-slate-800">
                {signal.averageIntervalDays != null ? `~${Math.round(signal.averageIntervalDays)} days` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Next expected order</dt>
              <dd className="text-sm font-medium tabular-nums text-slate-800">{nextExpected ? formatDate(nextExpected) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Est. next order value</dt>
              <dd className="text-sm font-medium tabular-nums text-slate-800">{formatCurrency(signal.estimatedOrderValue)}</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-400">
            Last order: {formatDate(signal.lastOrderDate)}. This is an opportunity signal based on past ordering cadence, not a guaranteed
            prediction — always confirm with the customer before assuming a reorder is due.
          </p>
        </div>
      )}
    </Card>
  );
}
