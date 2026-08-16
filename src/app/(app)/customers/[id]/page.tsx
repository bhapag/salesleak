import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerDetail } from "@/server/data/customers";
import { getCachedInsight } from "@/server/data/ai";
import { CustomerStatusBadge, RepeatOrderBadge } from "@/components/badges";
import { formatCurrency } from "@/lib/format";
import { OverviewCard } from "@/components/customers/detail/OverviewCard";
import { OpportunitySummaryCard } from "@/components/customers/detail/OpportunitySummaryCard";
import { RepeatOrderCard } from "@/components/customers/detail/RepeatOrderCard";
import { SignalsCard } from "@/components/customers/detail/SignalsCard";
import { RelatedListsCard } from "@/components/customers/detail/RelatedListsCard";
import { CustomerTimeline } from "@/components/customers/detail/CustomerTimeline";
import { AiCustomerSummaryCard, type CustomerSummaryData } from "@/components/ai/AiCustomerSummaryCard";
import { requireSession } from "@/server/auth/session";
import type { CustomerSummaryResult } from "@/server/ai/features/customerSummary";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const customer = await getCustomerDetail(id, session.companyId);
  if (!customer) notFound();

  const cachedInsight = await getCachedInsight(session.companyId, "CUSTOMER_SUMMARY", "Customer", id);
  const initialSummary: CustomerSummaryData | null = cachedInsight
    ? { ...(JSON.parse(cachedInsight.content) as CustomerSummaryResult), mocked: cachedInsight.mocked, generatedAt: cachedInsight.updatedAt }
    : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <Link href="/customers" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Back to Customers
        </Link>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{customer.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <CustomerStatusBadge status={customer.customerStatus} />
              <RepeatOrderBadge eligible={customer.repeatOrderSignal.eligible} status={customer.repeatOrderSignal.status} />
              <span className="text-sm text-slate-500">Won to date: {formatCurrency(customer.totalWonValue)}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <OverviewCard customer={customer} />
            <OpportunitySummaryCard customer={customer} />
            <RelatedListsCard customer={customer} />
            <CustomerTimeline customer={customer} />
          </div>

          <div className="flex flex-col gap-4">
            <AiCustomerSummaryCard customerId={customer.id} initial={initialSummary} />
            <RepeatOrderCard customer={customer} />
            <SignalsCard customer={customer} />
          </div>
        </div>
      </main>
    </div>
  );
}
