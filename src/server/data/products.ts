import { prisma } from "@/lib/prisma";

/** Tenant-scoped product catalog — used by the quotation line-item product picker. */
export async function getProductsForCompany(companyId: string) {
  return prisma.product.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

export type ProductOption = Awaited<ReturnType<typeof getProductsForCompany>>[number];
