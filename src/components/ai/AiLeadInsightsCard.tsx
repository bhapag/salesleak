"use client";

import { useState, useTransition } from "react";
import { getLeadInsights, approveNextActionSuggestion } from "@/server/actions/ai";
import { Card, SecondaryButton } from "@/components/ui";
import { AiBadge } from "@/components/ai/AiBadge";
import { formatDateTime } from "@/lib/format";

export type LeadInsightsData = {
  summary: string;
  prioritySignal: string;
  priorityReason: string;
  nextActionSuggestion: string;
  nextActionReason: string;
  suggestedDeadlineDays: number;
  mocked: boolean;
  generatedAt: Date;
};

const SIGNAL_STYLES: Record<string, string> = {
  "Urgent attention": "text-red-700",
  "High potential": "text-emerald-700",
  "Medium potential": "text-sky-700",
  "Low information": "text-slate-500",
};

export function AiLeadInsightsCard({ leadId, initial, actingUserId }: { leadId: string; initial: LeadInsightsData | null; actingUserId: string | null }) {
  const [data, setData] = useState<LeadInsightsData | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [pending, startTransition] = useTransition();

  function generate(force: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await getLeadInsights(leadId, force);
        setData(result);
        setApproved(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "AI summary unavailable right now.");
      }
    });
  }

  function approve() {
    startTransition(async () => {
      try {
        await approveNextActionSuggestion(leadId, actingUserId);
        setApproved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not schedule the follow-up.");
      }
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">AI Insights</h2>
          {data && <AiBadge mocked={data.mocked} />}
        </div>
        <SecondaryButton onClick={() => generate(true)} loading={pending} className="!py-1 !text-xs">
          {pending ? "Generating…" : data ? "Regenerate" : "Generate"}
        </SecondaryButton>
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-600">AI summary unavailable right now — {error}</p>}

      {!data && !error && (
        <p className="mt-2 text-xs text-slate-500">
          Get a quick AI-assisted summary, an advisory priority signal, and a suggested next action for this lead. Advisory
          only — it never changes the owner, status, or price.
        </p>
      )}

      {data && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-slate-700">{data.summary}</p>

          <div className="rounded-lg bg-slate-50 p-2.5">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${SIGNAL_STYLES[data.prioritySignal] ?? "text-slate-700"}`}>{data.prioritySignal}</span>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Advisory signal</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{data.priorityReason}</p>
          </div>

          <div className="rounded-lg border border-slate-200 p-2.5">
            <p className="text-xs font-semibold text-slate-700">Suggested next action</p>
            <p className="mt-0.5 text-sm text-slate-700">{data.nextActionSuggestion}</p>
            <p className="mt-0.5 text-xs text-slate-500">{data.nextActionReason}</p>
            {approved ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">Scheduled as a follow-up.</p>
            ) : (
              <SecondaryButton onClick={approve} loading={pending} className="mt-2 !py-1 !text-xs">
                Approve &amp; Schedule
              </SecondaryButton>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Generated {formatDateTime(data.generatedAt)}
            {data.mocked ? " · development mode — not a real AI response" : ""}
          </p>
        </div>
      )}
    </Card>
  );
}
