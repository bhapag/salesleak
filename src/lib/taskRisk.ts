import type { TaskStatus } from "@/generated/prisma/client";

/**
 * Task escalation logic — mirrors leadRisk.ts/quotationRisk.ts: one place that
 * buckets a task into Overdue/Due Today/Upcoming/Completed/Cancelled and flags
 * "seriously overdue", reused by the lead detail follow-ups card, the daily
 * work queue, My Day, and the team pages instead of each re-deriving it.
 */

export type TaskBucket = "overdue" | "due_today" | "upcoming" | "completed" | "cancelled";

export type TaskRiskInput = {
  status: TaskStatus;
  dueDate: Date;
};

export type TaskRisk = {
  bucket: TaskBucket;
  isOverdue: boolean;
  isSeriouslyOverdue: boolean;
  daysOverdue: number;
};

const SERIOUSLY_OVERDUE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `todayStart` defaults to `now` itself, preserving the original exact-instant
 * comparison for any caller that doesn't pass one — same optional, additive,
 * backward-compatible pattern as leadRisk.ts's `todayStart`. Callers that want
 * "overdue"/"due today" to respect the company's own timezone (rather than
 * the server's) should pass `startOfDayInTimezone(now, company.timezone)`
 * from src/lib/timezone.ts — see server/data/tasks.ts and team.ts.
 *
 * `dueDate` is compared directly against the day-boundary instants rather
 * than re-deriving its own "calendar day" via timezone conversion: a task's
 * dueDate is stored as the UTC instant for the picked date (e.g. a date-only
 * `<input>` submitted as "2026-08-20" parses to UTC midnight), so converting
 * that stored instant through `startOfDayInTimezone` again would shift it
 * onto the wrong calendar day for timezones behind UTC. Comparing the raw
 * instant against `todayStart`/`tomorrowStart` (both already computed in the
 * company's timezone) avoids that double conversion — same approach
 * leadRisk.ts already uses for `nextActionDeadline`.
 */
export function getTaskRisk(task: TaskRiskInput, now: Date = new Date(), todayStart: Date = now): TaskRisk {
  if (task.status === "COMPLETED") {
    return { bucket: "completed", isOverdue: false, isSeriouslyOverdue: false, daysOverdue: 0 };
  }
  if (task.status === "CANCELLED") {
    return { bucket: "cancelled", isOverdue: false, isSeriouslyOverdue: false, daysOverdue: 0 };
  }

  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);

  if (task.dueDate < todayStart) {
    const daysOverdue = Math.max(0, Math.round((todayStart.getTime() - task.dueDate.getTime()) / DAY_MS));
    return { bucket: "overdue", isOverdue: true, isSeriouslyOverdue: daysOverdue >= SERIOUSLY_OVERDUE_DAYS, daysOverdue };
  }
  if (task.dueDate < tomorrowStart) {
    return { bucket: "due_today", isOverdue: false, isSeriouslyOverdue: false, daysOverdue: 0 };
  }
  return { bucket: "upcoming", isOverdue: false, isSeriouslyOverdue: false, daysOverdue: 0 };
}

export const TASK_BUCKET_LABEL: Record<TaskBucket, string> = {
  overdue: "Overdue",
  due_today: "Due Today",
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
};
