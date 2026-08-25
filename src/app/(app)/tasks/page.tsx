import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getWorkQueueForCompany } from "@/server/data/tasks";
import { WorkQueueView } from "@/components/tasks/WorkQueueView";
import { requireSession } from "@/server/auth/session";
import { getOwnerScope } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const session = await requireSession();
  const ownerScope = getOwnerScope(session);

  const [workQueue, users] = await Promise.all([
    getWorkQueueForCompany(session.companyId, ownerScope ? { userId: ownerScope } : undefined),
    prisma.user.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }),
  ]);

  const totalOpen = workQueue.overdue.length + workQueue.dueToday.length + workQueue.upcoming.length;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-6 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Daily Work Queue</h1>
        <p className="text-sm text-slate-500">
          <span className="tabular-nums">{totalOpen}</span> open follow-up{totalOpen === 1 ? "" : "s"}
          {ownerScope ? " assigned to you" : " across the team"} · {session.companyName}
        </p>
      </header>

      <main className="px-4 py-6 sm:px-8">
        <WorkQueueView workQueue={workQueue} users={users.map((u) => ({ id: u.id, name: u.name }))} actingUserId={session.userId} />
      </main>
    </div>
  );
}
