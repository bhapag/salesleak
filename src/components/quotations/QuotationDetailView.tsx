import Link from "next/link";
import type { QuotationDetail } from "@/server/data/quotations";
import { QuotationStatusBadge } from "@/components/badges";
import { OverviewCard } from "@/components/quotations/detail/OverviewCard";
import { NextActionCard } from "@/components/quotations/detail/NextActionCard";
import { ActivityCard } from "@/components/quotations/detail/ActivityCard";
import { StatusCard } from "@/components/quotations/detail/StatusCard";
import { CloseDealCard } from "@/components/quotations/detail/CloseDealCard";
import { formatCurrency, formatDate } from "@/lib/format";

// Swaps the generic "deadline has passed" reason for a concrete day count —
// "Follow-up overdue by 2 days" is more actionable than a vague warning, same
// treatment as Lead Detail's WarningBanner (Group 6).
function concreteReasons(quotation: QuotationDetail): string[] {
  if (!quotation.risk.isOverdueFollowUp || !quotation.followUpDate) return quotation.risk.reasons;

  const days = Math.floor((Date.now() - quotation.followUpDate.getTime()) / (1000 * 60 * 60 * 24));
  const overdueLabel = days < 1 ? "Follow-up overdue today" : `Follow-up overdue by ${days} day${days === 1 ? "" : "s"}`;

  return quotation.risk.reasons.map((r) => (r === "Follow-up deadline has passed" ? overdueLabel : r));
}

export function QuotationDetailView({ quotation, currentUserId }: { quotation: QuotationDetail; currentUserId: string }) {
  const actingUserId = currentUserId;
  const reasons = concreteReasons(quotation);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-6 sm:px-8">
        <Link
          href="/quotations"
          className="text-sm font-medium text-slate-500 transition-colors duration-(--dur-micro) hover:text-slate-900"
        >
          ← Back to Quotations
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{quotation.quotationNumber}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{quotation.lead.customer.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <QuotationStatusBadge status={quotation.risk.displayStatus} />
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-2xl font-semibold tabular-nums text-brand-navy">{formatCurrency(quotation.value)}</p>
            <p className="text-xs text-slate-500">Total value</p>
          </div>
        </div>

        {/* At-a-glance strip — everything the top area should communicate
            without scrolling: linked opportunity, salesperson, key dates. */}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-400">Linked Lead</dt>
            <dd className="truncate">
              <Link href={`/leads/${quotation.leadId}`} className="text-slate-800 hover:underline">
                {quotation.lead.title}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Salesperson</dt>
            <dd className={quotation.lead.owner ? "text-slate-800" : "font-medium text-amber-700"}>
              {quotation.lead.owner ? quotation.lead.owner.name : "Unassigned"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Sent</dt>
            <dd className="text-slate-800">{quotation.sentAt ? formatDate(quotation.sentAt) : "Not sent yet"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Valid Until</dt>
            <dd className="text-slate-800">{quotation.validUntil ? formatDate(quotation.validUntil) : "—"}</dd>
          </div>
        </dl>
      </header>

      <main className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        {quotation.risk.needsAttention && (
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
              quotation.risk.isHighRiskOpportunity ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
            }`}
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`mt-0.5 h-5 w-5 shrink-0 ${quotation.risk.isHighRiskOpportunity ? "text-red-500" : "text-amber-500"}`}
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l6.516 11.598c.75 1.334-.213 2.98-1.743 2.98H3.484c-1.53 0-2.492-1.646-1.743-2.98L8.257 3.1zM10 7a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 7zm0 8a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className={`text-sm font-semibold ${quotation.risk.isHighRiskOpportunity ? "text-red-800" : "text-amber-800"}`}>
                {quotation.risk.isHighRiskOpportunity ? "High-risk opportunity — needs attention now" : "This quotation needs attention"}
              </p>
              <ul className={`mt-1 list-inside list-disc text-sm ${quotation.risk.isHighRiskOpportunity ? "text-red-700" : "text-amber-700"}`}>
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <OverviewCard quotation={quotation} />
            <NextActionCard quotation={quotation} actingUserId={actingUserId || null} />
            <ActivityCard quotation={quotation} actingUserId={actingUserId || null} />
          </div>

          <div className="flex flex-col gap-4">
            <StatusCard quotation={quotation} actingUserId={actingUserId || null} />
            <CloseDealCard
              quotation={quotation}
              actingUserId={actingUserId || null}
              lostReasonPresets={quotation.lead.company.lostReasonPresets ? (JSON.parse(quotation.lead.company.lostReasonPresets) as string[]) : []}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
