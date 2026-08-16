import { prisma } from "@/lib/prisma";
import { getQuotationsForCompany, getLeadPickerOptions, getSuggestedQuotationNumber } from "@/server/data/quotations";
import { getProductsForCompany } from "@/server/data/products";
import { QuotationsTable } from "@/components/quotations/QuotationsTable";
import { CreateQuotationEntry } from "@/components/quotations/CreateQuotationEntry";
import { requireSession } from "@/server/auth/session";
import { getOwnerScope } from "@/server/auth/permissions";

export default async function QuotationsPage() {
  const session = await requireSession();
  const ownerScope = getOwnerScope(session);

  const [allQuotations, users, leadOptions, products, suggestedQuotationNumber] = await Promise.all([
    getQuotationsForCompany(session.companyId),
    prisma.user.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }),
    getLeadPickerOptions(session.companyId, ownerScope),
    getProductsForCompany(session.companyId),
    getSuggestedQuotationNumber(session.companyId),
  ]);

  // Salespeople see only quotations on their own leads; Owner/Sales Manager see everyone's.
  const quotations = ownerScope ? allQuotations.filter((q) => q.lead.ownerId === ownerScope) : allQuotations;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <h1 className="text-xl font-semibold text-slate-900">Quotations</h1>
        <p className="text-sm text-slate-500">
          {quotations.length} quotation{quotations.length === 1 ? "" : "s"} · {session.companyName}
        </p>
      </header>

      <main className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        <CreateQuotationEntry
          leads={leadOptions}
          products={products}
          suggestedQuotationNumber={suggestedQuotationNumber}
          actingUserId={session.userId}
        />
        <QuotationsTable quotations={quotations} users={users.map((u) => ({ id: u.id, name: u.name }))} />
      </main>
    </div>
  );
}
