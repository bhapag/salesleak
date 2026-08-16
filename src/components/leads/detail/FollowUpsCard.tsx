"use client";

import { useState, useTransition } from "react";
import type { LeadDetail } from "@/server/data/leads";
import { Card, Field, PrimaryButton, SecondaryButton, ErrorText, inputClass, selectClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { scheduleFollowUp, completeTask } from "@/server/actions/leads";
import { getTaskRisk, TASK_BUCKET_LABEL, type TaskBucket } from "@/lib/taskRisk";

const statusStyle: Record<TaskBucket, string> = {
  overdue: "bg-red-50 text-red-700 ring-red-200",
  due_today: "bg-amber-50 text-amber-700 ring-amber-200",
  upcoming: "bg-slate-100 text-slate-600 ring-slate-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-400 ring-slate-200",
};

export function FollowUpsCard({
  lead,
  users,
  actingUserId,
}: {
  lead: LeadDetail;
  users: { id: string; name: string }[];
  actingUserId: string | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState(lead.ownerId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [completingId, setCompletingId] = useState<string | null>(null);

  const now = new Date();

  function handleAdd() {
    if (!title.trim()) {
      setError("Follow-up title is required.");
      return;
    }
    if (!dueDate) {
      setError("Due date is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await scheduleFollowUp(lead.id, title, dueDate, assignedToId || null, actingUserId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setTitle("");
      setDueDate("");
      setShowForm(false);
    });
  }

  function handleComplete(taskId: string) {
    setCompletingId(taskId);
    startTransition(async () => {
      try {
        await completeTask(taskId, lead.id, actingUserId);
      } finally {
        setCompletingId(null);
      }
    });
  }

  return (
    <Card title="Follow-ups" description="Scheduled reminders for this lead">
      {lead.tasks.length === 0 && !showForm && <p className="text-sm text-slate-500">No follow-ups scheduled yet.</p>}

      {lead.tasks.length > 0 && (
        <ul className="flex flex-col divide-y divide-slate-100">
          {lead.tasks.map((task) => {
            const risk = getTaskRisk(task, now);
            const assignee = users.find((u) => u.id === task.assignedToId);
            return (
              <li key={task.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">{task.title}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(task.dueDate)}
                    {assignee && ` · ${assignee.name}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusStyle[risk.bucket]}`}
                  >
                    {TASK_BUCKET_LABEL[risk.bucket]}
                  </span>
                  {task.status === "PENDING" && (
                    <button
                      type="button"
                      onClick={() => handleComplete(task.id)}
                      disabled={pending && completingId === task.id}
                      className="text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
                    >
                      {pending && completingId === task.id ? "…" : "Complete"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showForm ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
          <Field label="Follow-up">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Call to check on quotation decision"
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Assign to">
              <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className={selectClass}>
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <PrimaryButton onClick={handleAdd} disabled={pending}>
              {pending ? "Scheduling…" : "Schedule follow-up"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowForm(false)} disabled={pending}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      ) : (
        <SecondaryButton className="mt-4" onClick={() => setShowForm(true)}>
          + Schedule follow-up
        </SecondaryButton>
      )}
    </Card>
  );
}
