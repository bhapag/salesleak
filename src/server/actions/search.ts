"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";

export type SearchResultItem = { id: string; title: string; subtitle: string; href: string };
export type GlobalSearchResult = {
  customers: SearchResultItem[];
  leads: SearchResultItem[];
  quotations: SearchResultItem[];
};

const RESULT_LIMIT = 5;

/** Tenant-scoped search across customers, leads, and quotations by name, phone, email, company name, or quotation number. */
export async function globalSearch(rawQuery: string): Promise<GlobalSearchResult> {
  const session = await requireSession();
  const query = rawQuery.trim();
  if (query.length < 2) return { customers: [], leads: [], quotations: [] };

  const [customers, leads, quotations] = await Promise.all([
    prisma.customer.findMany({
      where: {
        companyId: session.companyId,
        OR: [{ name: { contains: query } }, { companyName: { contains: query } }, { phone: { contains: query } }, { email: { contains: query } }],
      },
      take: RESULT_LIMIT,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.lead.findMany({
      where: {
        companyId: session.companyId,
        OR: [
          { title: { contains: query } },
          { customer: { name: { contains: query } } },
          { customer: { companyName: { contains: query } } },
          { customer: { phone: { contains: query } } },
          { customer: { email: { contains: query } } },
        ],
      },
      include: { customer: true },
      take: RESULT_LIMIT,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.quotation.findMany({
      where: {
        lead: { companyId: session.companyId },
        OR: [
          { quotationNumber: { contains: query } },
          { lead: { customer: { name: { contains: query } } } },
          { lead: { customer: { companyName: { contains: query } } } },
          { lead: { customer: { phone: { contains: query } } } },
          { lead: { customer: { email: { contains: query } } } },
        ],
      },
      include: { lead: { include: { customer: true } } },
      take: RESULT_LIMIT,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    customers: customers.map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: [c.companyName, c.phone, c.email].filter(Boolean).join(" · ") || "Customer",
      href: `/customers/${c.id}`,
    })),
    leads: leads.map((l) => ({
      id: l.id,
      title: l.title,
      subtitle: [l.customer?.name, l.customer?.phone].filter(Boolean).join(" · ") || "Lead",
      href: `/leads/${l.id}`,
    })),
    quotations: quotations.map((q) => ({
      id: q.id,
      title: q.quotationNumber,
      subtitle: [q.lead.customer?.name, q.lead.title].filter(Boolean).join(" · ") || "Quotation",
      href: `/quotations/${q.id}`,
    })),
  };
}
