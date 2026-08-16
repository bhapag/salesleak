"use client";

import { useState, useTransition } from "react";
import { getSalesBrief } from "@/server/actions/ai";
import { SecondaryButton } from "@/components/ui";
import { AiBadge } from "@/components/ai/AiBadge";
import { formatDateTime } from "@/lib/format";

export type SalesBriefData = { brief: string; mocked: boolean; generatedAt: Date };

export function AiSalesBrief({ initial }: { initial: SalesBriefData | null }) {
  const [data, setData] = useState<SalesBriefData | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        setData(await getSalesBrief(true));
      } catch (e) {
        setError(e instanceof Error ? e.message : "AI brief unavailable right now.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">AI Sales Brief</h2>
          {data && <AiBadge mocked={data.mocked} />}
        </div>
        <SecondaryButton onClick={generate} disabled={pending} className="!py-1 !text-xs">
          {pending ? "Generating…" : data ? "Regenerate" : "Generate"}
        </SecondaryButton>
      </div>

      <div className="px-5 py-4">
        {error && <p className="text-xs font-medium text-red-600">AI brief unavailable right now — {error}</p>}

        {!data && !error && (
          <p className="text-xs text-slate-500">
            A short, AI-assisted read of today&apos;s biggest risks and opportunities — supplementary to the Money at Risk
            figures above, never a replacement for them.
          </p>
        )}

        {data && (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col gap-1.5">
              {data.brief
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <li key={i} className="text-sm text-slate-700">
                    {line.replace(/^-\s*/, "")}
                  </li>
                ))}
            </ul>
            <p className="text-[11px] text-slate-400">
              Generated {formatDateTime(data.generatedAt)}
              {data.mocked ? " · development mode — not a real AI response" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
