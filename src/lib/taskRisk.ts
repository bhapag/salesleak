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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function getTaskRisk(task: TaskRiskInput, now: Date = new Date()): TaskRisk {
  if (task.status === "COMPLETED") {
    return { bucket: "completed", isOverdue: false, isSeriouslyOverdue: false, daysOverdue: 0 };
  }
  if (task.status === "CANCELLED") {
    return { bucket: "cancelled", isOverdue: false, isSeriouslyOverdue: false, daysOverdue: 0 };
  }

  const today = startOfDay(now);
  const dueDay = startOfDay(task.dueDate);
  const daysOverdue = Math.max(0, Math.round((today.getTime() - dueDay.getTime()) / (1000 * 60 * 60 * 24)));

  if (dueDay < today) {
    return { bucket: "overdue", isOverdue: true, isSeriouslyOverdue: daysOverdue >= SERIOUSLY_OVERDUE_DAYS, daysOverdue };
  }
  if (dueDay.getTime() === today.getTime()) {
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
