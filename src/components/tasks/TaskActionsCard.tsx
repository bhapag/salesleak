"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PriorityBadge } from "@/components/badges";
import { formatCurrency, formatDate } from "@/lib/format";
import { TASK_BUCKET_LABEL, type TaskBucket, type TaskRisk } from "@/lib/taskRisk";
import { completeTask, updateNextAction, addNote } from "@/server/actions/leads";
import { rescheduleTask } from "@/server/actions/tasks";
import { Field, PrimaryButton, SecondaryButton, GhostButton, ErrorText, inputClass } from "@/components/ui";
import type { WorkQueueTask } from "@/server/data/tasks";

const bucketStyle: Record<TaskBucket, string> = {
  overdue: "bg-red-50 text-red-700 ring-red-200",
  due_today: "bg-amber-50 text-amber-700 ring-amber-200",
  upcoming: "bg-slate-100 text-slate-600 ring-slate-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-400 ring-slate-200",
};

// A left rail, not a full-card wash — same pattern as Leads/Quotations/
// Customers. Seriously overdue (3+ days, existing taskRisk.ts business logic)
// gets a stronger solid rail+badge than a task that's merely a day late, so
// urgency reads as a gradient rather than one flat "everything is red" state.
function riskRailClass(risk: TaskRisk): string {
  if (risk.bucket === "overdue") return risk.isSeriouslyOverdue ? "border-l-[3px] border-l-red-600" : "border-l-[3px] border-l-red-400";
  if (risk.bucket === "due_today") return "border-l-[3px] border-l-amber-400";
  return "border-l-[3px] border-l-transparent";
}

type ActiveForm = null | "reschedule" | "nextAction" | "note";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function TaskActionsCard({ task, actingUserId }: { task: WorkQueueTask; actingUserId: string | null }) {
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [nextAction, setNextAction] = useState(task.lead.nextAction ?? "");
  const [deadline, setDeadline] = useState(toDateInputValue(task.lead.nextActionDeadline));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openQuotation = task.lead.quotations[0];

  function toggleForm(form: ActiveForm) {
    setError(null);
    setActiveForm((current) => (current === form ? null : form));
  }

  function handleComplete() {
    setError(null);
    startTransition(async () => {
      try {
        await completeTask(task.id, task.leadId, actingUserId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleReschedule() {
    setError(null);
    startTransition(async () => {
      try {
        await rescheduleTask(task.id, rescheduleDate, actingUserId);
        setActiveForm(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleUpdateNextAction() {
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
      const result = await updateNextAction(task.leadId, nextAction, deadline, actingUserId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setActiveForm(null);
    });
  }

  function handleAddNote() {
    setError(null);
    startTransition(async () => {
      try {
        await addNote(task.leadId, note, actingUserId);
        setNote("");
        setActiveForm(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-card ${riskRailClass(task.risk)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{task.title}</p>
          <p className="text-xs text-slate-500">
            {task.lead.customer.name} ·{" "}
            <Link href={`/leads/${task.leadId}`} className="hover:underline">
              {task.lead.title}
            </Link>
            {task.assignedTo && ` · ${task.assignedTo.name}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PriorityBadge priority={task.lead.priority} />
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
              task.risk.isSeriouslyOverdue ? "bg-red-600 text-white font-semibold" : `ring-1 ring-inset ${bucketStyle[task.risk.bucket]}`
            }`}
          >
            {task.risk.bucket === "overdue" ? `${task.risk.daysOverdue}d overdue` : TASK_BUCKET_LABEL[task.risk.bucket]}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="tabular-nums">Due {formatDate(task.dueDate)}</span>
        <span className="tabular-nums">Value {formatCurrency(task.lead.estimatedValue)}</span>
        {openQuotation && (
          <Link href={`/quotations/${openQuotation.id}`} className="text-slate-600 transition-colors duration-(--dur-micro) hover:underline">
            Quotation {openQuotation.quotationNumber} →
          </Link>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={handleComplete} disabled={pending} className="!px-3 !py-1.5 text-xs">
          {pending && activeForm === null ? "…" : "Complete"}
        </PrimaryButton>
        <SecondaryButton onClick={() => toggleForm("reschedule")} className="!px-3 !py-1.5 text-xs">
          Reschedule
        </SecondaryButton>
        <GhostButton onClick={() => toggleForm("nextAction")} className="!px-3 !py-1.5 text-xs">
          Update Next Action
        </GhostButton>
        <GhostButton onClick={() => toggleForm("note")} className="!px-3 !py-1.5 text-xs">
          Add Note
        </GhostButton>
        <Link
          href={`/leads/${task.leadId}`}
          className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors duration-(--dur-micro) hover:bg-slate-100 hover:text-slate-900"
        >
          Open Lead
        </Link>
        {openQuotation && (
          <Link
            href={`/quotations/${openQuotation.id}`}
            className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors duration-(--dur-micro) hover:bg-slate-100 hover:text-slate-900"
          >
            Open Quotation
          </Link>
        )}
      </div>

      <ErrorText>{error}</ErrorText>

      {activeForm === "reschedule" && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <Field label="New due date">
            <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className={inputClass} />
          </Field>
          <PrimaryButton onClick={handleReschedule} disabled={pending || !rescheduleDate}>
            {pending ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>
      )}
      {activeForm === "nextAction" && (
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-end">
          <Field label="Next action">
            <input type="text" value={nextAction} onChange={(e) => setNextAction(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Deadline">
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
          </Field>
          <PrimaryButton onClick={handleUpdateNextAction} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>
      )}
      {activeForm === "note" && (
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Add a note..."
            className={`${inputClass} resize-none`}
          />
          <div>
            <PrimaryButton onClick={handleAddNote} disabled={pending || !note.trim()}>
              {pending ? "Adding…" : "Add note"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
