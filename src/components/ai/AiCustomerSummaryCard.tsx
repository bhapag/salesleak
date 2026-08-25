"use client";

import { useState, useTransition } from "react";
import { getCustomerInsights } from "@/server/actions/ai";
import { Card, SecondaryButton } from "@/components/ui";
import { AiBadge } from "@/components/ai/AiBadge";
import { formatDateTime } from "@/lib/format";

export type CustomerSummaryData = {
  summary: string;
  outstandingAction: string | null;
  mocked: boolean;
  generatedAt: Date;
};

export function AiCustomerSummaryCard({ customerId, initial }: { customerId: string; initial: CustomerSummaryData | null }) {
  const [data, setData] = useState<CustomerSummaryData | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        setData(await getCustomerInsights(customerId, true));
      } catch (e) {
        setError(e instanceof Error ? e.message : "AI summary unavailable right now.");
      }
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">AI Summary</h2>
          {data && <AiBadge mocked={data.mocked} />}
        </div>
        <SecondaryButton onClick={generate} loading={pending} className="!py-1 !text-xs">
          {pending ? "Generating…" : data ? "Regenerate" : "Generate"}
        </SecondaryButton>
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-600">AI summary unavailable right now — {error}</p>}

      {!data && !error && (
        <p className="mt-2 text-xs text-slate-500">Get a short AI-assisted summary of this customer&apos;s relationship history.</p>
      )}

      {data && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-slate-700">{data.summary}</p>
          {data.outstandingAction && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
              <p className="text-xs font-semibold text-amber-800">Outstanding</p>
              <p className="mt-0.5 text-xs text-amber-800">{data.outstandingAction}</p>
            </div>
          )}
          <p className="text-[11px] text-slate-400">
            Generated {formatDateTime(data.generatedAt)}
            {data.mocked ? " · development mode — not a real AI response" : ""}
          </p>
        </div>
      )}
    </Card>
  );
}
