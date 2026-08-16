import type { CustomerDetail } from "@/server/data/customers";
import { Card } from "@/components/ui";
import { RepeatOrderBadge } from "@/components/badges";
import { formatCurrency, formatDate } from "@/lib/format";

export function RepeatOrderCard({ customer }: { customer: CustomerDetail }) {
  const signal = customer.repeatOrderSignal;

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
          <div>
            <RepeatOrderBadge eligible={signal.eligible} status={signal.status} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-400">Won orders</dt>
              <dd className="text-sm font-medium text-slate-800">{signal.wonOrderCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Avg. time between orders</dt>
              <dd className="text-sm font-medium text-slate-800">
                {signal.averageIntervalDays != null ? `~${Math.round(signal.averageIntervalDays)} days` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Days since last order</dt>
              <dd className="text-sm font-medium text-slate-800">{signal.daysSinceLastOrder ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Est. next order value</dt>
              <dd className="text-sm font-medium text-slate-800">{formatCurrency(signal.estimatedOrderValue)}</dd>
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
