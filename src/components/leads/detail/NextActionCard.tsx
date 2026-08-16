"use client";

import { useState, useTransition } from "react";
import type { LeadDetail } from "@/server/data/leads";
import { Card, Field, PrimaryButton, SecondaryButton, ErrorText, inputClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { markContacted, updateNextAction } from "@/server/actions/leads";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function NextActionCard({ lead, actingUserId }: { lead: LeadDetail; actingUserId: string | null }) {
  const [editing, setEditing] = useState(false);
  const [nextAction, setNextAction] = useState(lead.nextAction ?? "");
  const [deadline, setDeadline] = useState(toDateInputValue(lead.nextActionDeadline));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!lead.risk.isActive) {
    return (
      <Card title="Next Action">
        <p className="text-sm text-slate-500">
          {lead.status === "WON" ? "Deal won — no further action needed." : "Deal lost — no further action needed."}
        </p>
      </Card>
    );
  }

  function handleSave() {
    if (!nextAction.trim()) {
      setError("Next action is required.");
      return;
    }
    if (!deadline) {
      setError("Deadline is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateNextAction(lead.id, nextAction, deadline, actingUserId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function handleOpenEdit() {
    setNextAction(lead.nextAction ?? "");
    setDeadline(toDateInputValue(lead.nextActionDeadline));
    setError(null);
    setEditing(true);
  }

  function handleMarkContacted() {
    setError(null);
    startTransition(async () => {
      try {
        await markContacted(lead.id, actingUserId);
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
            <p className="text-xs text-slate-400">What&apos;s next</p>
            <p className={`text-sm ${lead.nextAction ? "text-slate-800" : "font-medium text-amber-700"}`}>
              {lead.nextAction ?? "No next action set — this lead needs one."}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Deadline</p>
            <p className={`text-sm ${lead.risk.isOverdue ? "font-medium text-red-600" : lead.nextActionDeadline ? "text-slate-800" : "font-medium text-amber-700"}`}>
              {lead.nextActionDeadline ? formatDate(lead.nextActionDeadline) : "No deadline set"}
              {lead.risk.isOverdue && " — overdue"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={handleOpenEdit}>Update next action</SecondaryButton>
            {lead.status === "NEW" && (
              <SecondaryButton onClick={handleMarkContacted} disabled={pending}>
                {pending ? "Saving…" : "Mark contacted"}
              </SecondaryButton>
            )}
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Field label="Next action">
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Call customer to confirm quotation"
              className={inputClass}
            />
          </Field>
          <Field label="Deadline">
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <PrimaryButton onClick={handleSave} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setEditing(false);
                setError(null);
                setNextAction(lead.nextAction ?? "");
                setDeadline(toDateInputValue(lead.nextActionDeadline));
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
