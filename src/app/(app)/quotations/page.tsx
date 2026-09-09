import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getQuotationsForCompany, getLeadPickerOptions, getSuggestedQuotationNumber } from "@/server/data/quotations";
import { getProductsForCompany } from "@/server/data/products";
import { QuotationsTable } from "@/components/quotations/QuotationsTable";
import { CreateQuotationEntry } from "@/components/quotations/CreateQuotationEntry";
import { PageHeader } from "@/components/PageHeader";
import { requireSession } from "@/server/auth/session";
import { getOwnerScope } from "@/server/auth/permissions";
import { getSubscriptionState } from "@/server/billing/entitlements";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage() {
  const session = await requireSession();
  const ownerScope = getOwnerScope(session);

  const [allQuotations, users, leadOptions, products, suggestedQuotationNumber, subscription] = await Promise.all([
    getQuotationsForCompany(session.companyId),
    prisma.user.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }),
    getLeadPickerOptions(session.companyId, ownerScope),
    getProductsForCompany(session.companyId),
    getSuggestedQuotationNumber(session.companyId),
    getSubscriptionState(session.companyId),
  ]);

  // Salespeople see only quotations on their own leads; Owner/Sales Manager see everyone's.
  const quotations = ownerScope ? allQuotations.filter((q) => q.lead.ownerId === ownerScope) : allQuotations;

  return (
    <div className="min-h-screen">
      <PageHeader title="Quotations" subtitle={`${quotations.length} quotation${quotations.length === 1 ? "" : "s"} · ${session.companyName}`} />

      <main className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        <CreateQuotationEntry
          leads={leadOptions}
          products={products}
          suggestedQuotationNumber={suggestedQuotationNumber}
          actingUserId={session.userId}
          isReadOnly={subscription.isReadOnly}
          isOwner={session.role === "OWNER"}
        />
        <QuotationsTable quotations={quotations} users={users.map((u) => ({ id: u.id, name: u.name }))} />
      </main>
    </div>
  );
}
