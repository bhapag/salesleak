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

// Postgres `contains` is case-sensitive by default; every text filter below
// opts into Prisma's case-insensitive mode so "acme"/"Acme"/"ACME" all match
// the same records.
const insensitive = { mode: "insensitive" as const };

/** Tenant-scoped search across customers, leads, and quotations by name, phone, email, company name, or quotation number. */
export async function globalSearch(rawQuery: string): Promise<GlobalSearchResult> {
  const session = await requireSession();
  const query = rawQuery.trim();
  if (query.length < 2) return { customers: [], leads: [], quotations: [] };

  const [customers, leads, quotations] = await Promise.all([
    prisma.customer.findMany({
      where: {
        companyId: session.companyId,
        OR: [
          { name: { contains: query, ...insensitive } },
          { companyName: { contains: query, ...insensitive } },
          { phone: { contains: query, ...insensitive } },
          { email: { contains: query, ...insensitive } },
        ],
      },
      take: RESULT_LIMIT,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.lead.findMany({
      where: {
        companyId: session.companyId,
        OR: [
          { title: { contains: query, ...insensitive } },
          { customer: { name: { contains: query, ...insensitive } } },
          { customer: { companyName: { contains: query, ...insensitive } } },
          { customer: { phone: { contains: query, ...insensitive } } },
          { customer: { email: { contains: query, ...insensitive } } },
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
          { quotationNumber: { contains: query, ...insensitive } },
          { lead: { customer: { name: { contains: query, ...insensitive } } } },
          { lead: { customer: { companyName: { contains: query, ...insensitive } } } },
          { lead: { customer: { phone: { contains: query, ...insensitive } } } },
          { lead: { customer: { email: { contains: query, ...insensitive } } } },
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
