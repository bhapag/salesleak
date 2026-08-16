"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TaskActionsCard } from "./TaskActionsCard";
import { formatDate } from "@/lib/format";
import type { WorkQueue, WorkQueueTask } from "@/server/data/tasks";

export function WorkQueueView({
  workQueue,
  users,
  actingUserId,
}: {
  workQueue: WorkQueue;
  users: { id: string; name: string }[];
  actingUserId: string | null;
}) {
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("ALL");

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (task: WorkQueueTask) => {
      if (ownerFilter !== "ALL" && task.assignedToId !== ownerFilter) return false;
      if (q) {
        const haystack = [task.title, task.lead.customer.name, task.lead.title].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    };
  }, [search, ownerFilter]);

  const overdue = useMemo(() => workQueue.overdue.filter(matches), [workQueue.overdue, matches]);
  const dueToday = useMemo(() => workQueue.dueToday.filter(matches), [workQueue.dueToday, matches]);
  const upcoming = useMemo(() => workQueue.upcoming.filter(matches), [workQueue.upcoming, matches]);
  const completed = useMemo(() => workQueue.completed.filter(matches), [workQueue.completed, matches]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer, lead, action..."
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
        />
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
        >
          <option value="ALL">All salespeople</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <WorkQueueSection title="Overdue" tone="red" tasks={overdue} actingUserId={actingUserId} emptyText="No overdue follow-ups. Nice work." />
      <WorkQueueSection title="Due Today" tone="amber" tasks={dueToday} actingUserId={actingUserId} emptyText="Nothing due today." />
      <WorkQueueSection title="Upcoming" tone="slate" tasks={upcoming} actingUserId={actingUserId} emptyText="No upcoming follow-ups scheduled." />

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Completed</h2>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 text-xs font-semibold text-emerald-700">
            {completed.length}
          </span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {completed.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">No completed follow-ups yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {completed.map((task) => (
                <CompletedTaskRow key={task.id} task={task} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkQueueSection({
  title,
  tone,
  tasks,
  actingUserId,
  emptyText,
}: {
  title: string;
  tone: "red" | "amber" | "slate";
  tasks: WorkQueueTask[];
  actingUserId: string | null;
  emptyText: string;
}) {
  const toneClass = tone === "red" ? "bg-red-100 text-red-700" : tone === "amber" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${toneClass}`}>
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskActionsCard key={task.id} task={task} actingUserId={actingUserId} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompletedTaskRow({ task }: { task: WorkQueueTask }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-700">{task.title}</p>
        <p className="text-xs text-slate-400">
          {task.lead.customer.name} ·{" "}
          <Link href={`/leads/${task.leadId}`} className="hover:underline">
            {task.lead.title}
          </Link>
        </p>
      </div>
      <span className="shrink-0 text-xs text-slate-400">{task.completedAt ? formatDate(task.completedAt) : ""}</span>
    </li>
  );
}
