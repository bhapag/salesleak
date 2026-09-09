import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCustomersForCompany } from "@/server/data/customers";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { PageHeader } from "@/components/PageHeader";
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
      <PageHeader title="Customers" subtitle={`${customers.length} customer${customers.length === 1 ? "" : "s"} · ${session.companyName}`} />

      <main className="px-4 py-6 sm:px-8">
        <CustomersTable customers={customers} users={users.map((u) => ({ id: u.id, name: u.name }))} />
      </main>
    </div>
  );
}
