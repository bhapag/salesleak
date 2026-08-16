"use server";

import { requireSession } from "@/server/auth/session";
import { canManageCompany, ForbiddenError } from "@/server/auth/permissions";
import { getCustomersForCompany } from "@/server/data/customers";
import { getLeadsForCompany } from "@/server/data/leads";
import { getQuotationsForCompany } from "@/server/data/quotations";
import { toCsv } from "@/lib/csv";
import { formatDate, labelize } from "@/lib/format";

export type ExportEntity = "customers" | "leads" | "quotations";

/**
 * Simple company-data CSV export (Phase 13) — for pilot trust/backup
 * safety, not a backup/restore system. Owner-only; every query is
 * tenant-scoped through the same data functions the app's own pages use,
 * so an export can never contain another company's rows.
 */
export async function exportCompanyDataCsv(entity: ExportEntity): Promise<{ filename: string; csv: string }> {
  const session = await requireSession();
  if (!canManageCompany(session.role)) throw new ForbiddenError("Only the Owner can export company data.");

  const today = new Date().toISOString().slice(0, 10);

  if (entity === "customers") {
    const customers = await getCustomersForCompany(session.companyId);
    const csv = toCsv(
      ["Name", "Contact Person", "Phone", "Email", "City", "State", "GST Number", "Status", "Total Won Value", "Total Opportunity Value", "Created"],
      customers.map((c) => [
        c.name,
        c.contactPerson,
        c.phone,
        c.email,
        c.city,
        c.state,
        c.gstNumber,
        c.customerStatus,
        c.totalWonValue,
        c.totalOpportunityValue,
        formatDate(c.createdAt),
      ])
    );
    return { filename: `salesleak-customers-${today}.csv`, csv };
  }

  if (entity === "leads") {
    const leads = await getLeadsForCompany(session.companyId);
    const csv = toCsv(
      ["Title", "Customer", "Source", "Product", "Quantity", "Estimated Value", "Owner", "Status", "Priority", "Next Action", "Deadline", "Created"],
      leads.map((l) => [
        l.title,
        l.customer.name,
        labelize(l.source),
        l.product,
        l.quantity,
        l.estimatedValue,
        l.owner?.name ?? "Unassigned",
        labelize(l.status),
        labelize(l.priority),
        l.nextAction,
        formatDate(l.nextActionDeadline),
        formatDate(l.createdAt),
      ])
    );
    return { filename: `salesleak-leads-${today}.csv`, csv };
  }

  const quotations = await getQuotationsForCompany(session.companyId);
  const csv = toCsv(
    ["Quotation Number", "Customer", "Lead", "Salesperson", "Status", "Value", "Sent Date", "Follow-up Deadline", "Created"],
    quotations.map((q) => [
      q.quotationNumber,
      q.lead.customer.name,
      q.lead.title,
      q.lead.owner?.name ?? "Unassigned",
      labelize(q.status),
      q.value,
      formatDate(q.sentAt),
      formatDate(q.followUpDate),
      formatDate(q.createdAt),
    ])
  );
  return { filename: `salesleak-quotations-${today}.csv`, csv };
}
