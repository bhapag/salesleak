"use client";

import { useState, useTransition } from "react";
import type { QuotationDetail } from "@/server/data/quotations";
import { Card, Field, PrimaryButton, SecondaryButton, ErrorText, inputClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { markQuotationSent, updateQuotationNextAction } from "@/server/actions/quotations";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function NextActionCard({ quotation, actingUserId }: { quotation: QuotationDetail; actingUserId: string | null }) {
  const [editing, setEditing] = useState(false);
  const [nextAction, setNextAction] = useState(quotation.nextAction ?? "");
  const [followUpDate, setFollowUpDate] = useState(toDateInputValue(quotation.followUpDate));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!quotation.risk.isOpen) {
    return (
      <Card title="Next Action">
        <p className="text-sm text-slate-500">
          {quotation.status === "ACCEPTED" ? "Quotation won — no further action needed." : "Quotation closed — no further action needed."}
        </p>
      </Card>
    );
  }

  function handleOpenEdit() {
    setNextAction(quotation.nextAction ?? "");
    setFollowUpDate(toDateInputValue(quotation.followUpDate));
    setError(null);
    setEditing(true);
  }

  function handleSave() {
    if (!nextAction.trim()) {
      setError("Next action is required.");
      return;
    }
    if (!followUpDate) {
      setError("Follow-up deadline is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateQuotationNextAction(quotation.id, nextAction, followUpDate, actingUserId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function handleMarkSent() {
    setError(null);
    startTransition(async () => {
      try {
        await markQuotationSent(quotation.id, actingUserId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Card title="Next Action">
      {!editing ? (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs text-slate-400">Next follow-up</p>
            <p className={`text-sm ${quotation.nextAction ? "text-slate-800" : "font-medium text-amber-700"}`}>
              {quotation.nextAction ?? "No next action set."}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Follow-up deadline</p>
            <p
              className={`text-sm ${
                quotation.risk.isOverdueFollowUp ? "font-medium text-red-600" : quotation.followUpDate ? "text-slate-800" : "font-medium text-amber-700"
              }`}
            >
              {quotation.followUpDate ? formatDate(quotation.followUpDate) : "No deadline set"}
              {quotation.risk.isOverdueFollowUp && " — overdue"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={handleOpenEdit}>
              {quotation.nextAction ? "Update next action" : "Schedule follow-up"}
            </SecondaryButton>
            {quotation.status === "DRAFT" && (
              <SecondaryButton onClick={handleMarkSent} disabled={pending}>
                {pending ? "Saving…" : "Mark sent"}
              </SecondaryButton>
            )}
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Field label="Next follow-up">
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Call to confirm quotation approval"
              className={inputClass}
            />
          </Field>
          <Field label="Follow-up deadline">
            <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className={inputClass} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <PrimaryButton onClick={handleSave} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}
    </Card>
  );
}
