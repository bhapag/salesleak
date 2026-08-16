import Link from "next/link";
import type { LeadDetail } from "@/server/data/leads";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { WarningBanner } from "@/components/leads/detail/WarningBanner";
import { OverviewCard } from "@/components/leads/detail/OverviewCard";
import { NextActionCard } from "@/components/leads/detail/NextActionCard";
import { FollowUpsCard } from "@/components/leads/detail/FollowUpsCard";
import { QuotationsCard } from "@/components/leads/detail/QuotationsCard";
import { ActivityTimeline } from "@/components/leads/detail/ActivityTimeline";
import { StatusAssignmentCard } from "@/components/leads/detail/StatusAssignmentCard";
import { CloseDealCard } from "@/components/leads/detail/CloseDealCard";
import { AiLeadInsightsCard, type LeadInsightsData } from "@/components/ai/AiLeadInsightsCard";
import { formatCurrency } from "@/lib/format";

type UserOption = { id: string; name: string; role: string };

export function LeadDetailView({
  lead,
  users,
  currentUserId,
  initialInsight,
}: {
  lead: LeadDetail;
  users: UserOption[];
  currentUserId: string;
  initialInsight: LeadInsightsData | null;
}) {
  const actingUserId = currentUserId;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <Link href="/leads" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Back to Leads
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{lead.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={lead.status} />
              <PriorityBadge priority={lead.priority} />
              <span className="text-sm text-slate-500">{formatCurrency(lead.estimatedValue)}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        <WarningBanner risk={lead.risk} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <OverviewCard lead={lead} />
            <NextActionCard lead={lead} actingUserId={actingUserId || null} />
            <FollowUpsCard lead={lead} users={users} actingUserId={actingUserId || null} />
            <QuotationsCard lead={lead} />
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
