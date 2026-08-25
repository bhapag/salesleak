import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCustomersForCompany } from "@/server/data/customers";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { requireSession } from "@/server/auth/session";
import { getOwnerScope } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const session = await requireSession();
  const ownerScope = getOwnerScope(session);

  const [allCustomers, users] = await Promise.all([
    getCustomersForCompany(session.companyId),
    prisma.user.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }),
  ]);

  // Salespeople see only customers whose most recent lead is assigned to them
  // ("relevant customers"); Owner/Sales Manager see the whole book.
  const customers = ownerScope ? allCustomers.filter((c) => c.assignedSalesperson?.id === ownerScope) : allCustomers;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-6 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Customers</h1>
        <p className="text-sm text-slate-500">
          {customers.length} customer{customers.length === 1 ? "" : "s"} · {session.companyName}
        </p>
      </header>

      <main className="px-4 py-6 sm:px-8">
        <CustomersTable customers={customers} users={users.map((u) => ({ id: u.id, name: u.name }))} />
      </main>
    </div>
  );
}
