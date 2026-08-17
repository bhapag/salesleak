import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getLeadsForCompany } from "@/server/data/leads";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { AddLeadCard } from "@/components/leads/AddLeadCard";
import { requireSession } from "@/server/auth/session";
import { getOwnerScope } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage() {
  const session = await requireSession();
  const ownerScope = getOwnerScope(session);

  const [allLeads, users, company] = await Promise.all([
    getLeadsForCompany(session.companyId),
    prisma.user.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }),
    prisma.company.findFirstOrThrow({ where: { id: session.companyId }, select: { defaultPriority: true, defaultFollowUpDays: true } }),
  ]);

  // Salespeople see only their own leads; Owner/Sales Manager see everyone's.
  const leads = ownerScope ? allLeads.filter((l) => l.ownerId === ownerScope) : allLeads;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <h1 className="text-xl font-semibold text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500">
          {leads.length} lead{leads.length === 1 ? "" : "s"} · {session.companyName}
        </p>
      </header>

      <main className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        <AddLeadCard
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          defaultPriority={company.defaultPriority}
          defaultFollowUpDays={company.defaultFollowUpDays}
        />
        <LeadsTable leads={leads} users={users.map((u) => ({ id: u.id, name: u.name }))} />
      </main>
    </div>
  );
}
