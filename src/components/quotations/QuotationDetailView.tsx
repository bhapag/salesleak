import Link from "next/link";
import type { QuotationDetail } from "@/server/data/quotations";
import { QuotationStatusBadge } from "@/components/badges";
import { OverviewCard } from "@/components/quotations/detail/OverviewCard";
import { NextActionCard } from "@/components/quotations/detail/NextActionCard";
import { ActivityCard } from "@/components/quotations/detail/ActivityCard";
import { StatusCard } from "@/components/quotations/detail/StatusCard";
import { CloseDealCard } from "@/components/quotations/detail/CloseDealCard";
import { formatCurrency } from "@/lib/format";

export function QuotationDetailView({ quotation, currentUserId }: { quotation: QuotationDetail; currentUserId: string }) {
  const actingUserId = currentUserId;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <Link href="/quotations" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Back to Quotations
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{quotation.quotationNumber}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <QuotationStatusBadge status={quotation.risk.displayStatus} />
              <span className="text-sm text-slate-500">{formatCurrency(quotation.value)}</span>
            </div>
          </div>
        </div>
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
                {quotation.risk.reasons.map((r) => (
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
