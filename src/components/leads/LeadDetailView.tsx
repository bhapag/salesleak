import Link from "next/link";
import type { LeadDetail } from "@/server/data/leads";
import { StatusBadge, PriorityBadge, SourceBadge } from "@/components/badges";
import { WarningBanner } from "@/components/leads/detail/WarningBanner";
import { OverviewCard } from "@/components/leads/detail/OverviewCard";
import { NextActionCard } from "@/components/leads/detail/NextActionCard";
import { FollowUpsCard } from "@/components/leads/detail/FollowUpsCard";
import { QuotationsCard } from "@/components/leads/detail/QuotationsCard";
import { ActivityTimeline } from "@/components/leads/detail/ActivityTimeline";
import { StatusAssignmentCard } from "@/components/leads/detail/StatusAssignmentCard";
import { CloseDealCard } from "@/components/leads/detail/CloseDealCard";
import { AiLeadInsightsCard, type LeadInsightsData } from "@/components/ai/AiLeadInsightsCard";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ProductOption } from "@/server/data/products";

type UserOption = { id: string; name: string; role: string };

export function LeadDetailView({
  lead,
  users,
  currentUserId,
  initialInsight,
  products,
  suggestedQuotationNumber,
  autoOpenQuotationForm = false,
}: {
  lead: LeadDetail;
  users: UserOption[];
  currentUserId: string;
  initialInsight: LeadInsightsData | null;
  products: ProductOption[];
  suggestedQuotationNumber: string;
  autoOpenQuotationForm?: boolean;
}) {
  const actingUserId = currentUserId;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <Link
          href="/leads"
          className="text-sm font-medium text-slate-500 transition-colors duration-(--dur-micro) hover:text-slate-900"
        >
          ← Back to Leads
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">{lead.title}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{lead.customer.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={lead.status} />
              <PriorityBadge priority={lead.priority} />
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-2xl font-semibold tabular-nums text-brand-navy">{formatCurrency(lead.estimatedValue)}</p>
            <p className="text-xs text-slate-500">Opportunity value</p>
          </div>
        </div>

        {/* At-a-glance strip — everything the top area should communicate
            without scrolling: owner, next step, deadline, source. Customer,
            status, and value are already covered above. */}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-400">Owner</dt>
            <dd className={lead.owner ? "text-slate-800" : "font-medium text-amber-700"}>{lead.owner ? lead.owner.name : "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Next Action</dt>
            <dd className={`truncate ${lead.nextAction ? "text-slate-800" : lead.risk.isActive ? "font-medium text-amber-700" : "text-slate-400"}`}>
              {lead.nextAction ?? (lead.risk.isActive ? "Not set" : "—")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Deadline</dt>
            <dd
              className={
                lead.risk.isOverdue
                  ? "font-medium text-red-600"
                  : lead.nextActionDeadline
                    ? "text-slate-800"
                    : lead.risk.isActive
                      ? "font-medium text-amber-700"
                      : "text-slate-400"
              }
            >
              {lead.nextActionDeadline ? formatDate(lead.nextActionDeadline) : lead.risk.isActive ? "Not set" : "—"}
              {lead.risk.isOverdue && " · overdue"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Source</dt>
            <dd className="mt-0.5">
              <SourceBadge source={lead.source} />
            </dd>
          </div>
        </dl>
      </header>

      <main className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        <WarningBanner lead={lead} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <OverviewCard lead={lead} />
            <NextActionCard lead={lead} actingUserId={actingUserId || null} />
            <FollowUpsCard lead={lead} users={users} actingUserId={actingUserId || null} />
            <QuotationsCard
              lead={lead}
              products={products}
              suggestedQuotationNumber={suggestedQuotationNumber}
              actingUserId={actingUserId || null}
              autoOpen={autoOpenQuotationForm}
            />
            <ActivityTimeline lead={lead} actingUserId={actingUserId || null} />
          </div>

          <div className="flex flex-col gap-4">
            <StatusAssignmentCard lead={lead} users={users} actingUserId={actingUserId || null} />
            <AiLeadInsightsCard leadId={lead.id} initial={initialInsight} actingUserId={actingUserId || null} />
            <CloseDealCard
              lead={lead}
              actingUserId={actingUserId || null}
              lostReasonPresets={lead.company.lostReasonPresets ? (JSON.parse(lead.company.lostReasonPresets) as string[]) : []}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
