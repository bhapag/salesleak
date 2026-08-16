"use client";

import { useState, useTransition } from "react";
import type { QuotationDetail } from "@/server/data/quotations";
import { Card, PrimaryButton, SecondaryButton, DangerButton, ErrorText, inputClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { markQuotationWon, markQuotationLost } from "@/server/actions/quotations";

export function CloseDealCard({
  quotation,
  actingUserId,
  lostReasonPresets = [],
}: {
  quotation: QuotationDetail;
  actingUserId: string | null;
  lostReasonPresets?: string[];
}) {
  const [showLostForm, setShowLostForm] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (quotation.status === "ACCEPTED") {
    return (
      <Card title="Deal Outcome">
        <p className="text-sm font-medium text-emerald-700">Won{quotation.wonAt && ` on ${formatDate(quotation.wonAt)}`}</p>
      </Card>
    );
  }

  if (quotation.status === "REJECTED") {
    return (
      <Card title="Deal Outcome">
        <p className="text-sm font-medium text-red-700">Lost{quotation.lostAt && ` on ${formatDate(quotation.lostAt)}`}</p>
        {quotation.lostReason && <p className="mt-1 text-sm text-slate-600">Reason: {quotation.lostReason}</p>}
      </Card>
    );
  }

  function handleWon() {
    setError(null);
    startTransition(async () => {
      try {
        await markQuotationWon(quotation.id, actingUserId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleLost() {
    setError(null);
    startTransition(async () => {
      try {
        await markQuotationLost(quotation.id, lostReason, actingUserId);
        setShowLostForm(false);
        setLostReason("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Card title="Close Deal">
      {!showLostForm ? (
        <div className="flex flex-col gap-2">
          <PrimaryButton onClick={handleWon} disabled={pending} className="bg-emerald-600 hover:bg-emerald-700">
            {pending ? "Saving…" : "Mark Won"}
          </PrimaryButton>
          <SecondaryButton onClick={() => setShowLostForm(true)} disabled={pending}>
            Mark Lost
          </SecondaryButton>
          <ErrorText>{error}</ErrorText>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lostReasonPresets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lostReasonPresets.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setLostReason(reason)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    lostReason === reason ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Lost reason (required)</span>
            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Customer chose a cheaper competitor"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </label>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <DangerButton onClick={handleLost} disabled={pending || !lostReason.trim()}>
              {pending ? "Saving…" : "Confirm Lost"}
            </DangerButton>
            <SecondaryButton
              onClick={() => {
                setShowLostForm(false);
                setLostReason("");
                setError(null);
              }}
              disabled={pending}
            >
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}
    </Card>
  );
}
