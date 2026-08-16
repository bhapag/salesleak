"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { LeadSource, LeadPriority } from "@/generated/prisma/client";
import { requireSession } from "@/server/auth/session";
import { ingestLead } from "@/server/ingestion/pipeline";
import type { NormalizedLeadInput } from "@/server/ingestion/types";

function revalidateAfterIngestion() {
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath("/customers");
  revalidatePath("/settings/integrations");
}

// ---------- Manual entry ----------

export type ManualLeadFormInput = {
  customerName: string;
  companyName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  source: LeadSource;
  product: string;
  quantity: string;
  requirement: string;
  estimatedValue: string;
  assignToUserId: string;
  priority: LeadPriority;
  nextAction: string;
  nextActionDeadline: string;
};

export type ManualLeadResult =
  | { status: "created"; leadId: string }
  | { status: "duplicate"; reason: string; matchedCustomerId?: string }
  | { status: "invalid"; errors: string[] };

function toNormalizedInput(form: ManualLeadFormInput): NormalizedLeadInput {
  const value = form.estimatedValue.trim();
  return {
    source: form.source,
    customerName: form.customerName.trim(),
    companyName: form.companyName.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    requirement: form.requirement.trim() || null,
    product: form.product.trim() || null,
    quantity: form.quantity.trim() || null,
    estimatedValue: value ? Number(value) : null,
    assignToUserId: form.assignToUserId || null,
    priority: form.priority,
    nextAction: form.nextAction.trim() || null,
    nextActionDeadline: form.nextActionDeadline ? new Date(form.nextActionDeadline) : null,
  };
}

/**
 * Every manual add goes through the same ingestLead() pipeline as CSV rows
 * and future connectors — source is just whatever the user picked in the
 * form, not hardcoded to MANUAL, since "manually logging a phone call" is a
 * real, common case. forceCreate is the client's answer to a prior
 * "possible duplicate, create anyway?" prompt — the form calls this once to
 * check, shows the warning if any, then calls again with forceCreate: true.
 */
export async function createManualLead(form: ManualLeadFormInput, forceCreate = false): Promise<ManualLeadResult> {
  const session = await requireSession();

  if (!form.customerName.trim()) return { status: "invalid", errors: ["Customer or company name is required."] };
  if (!form.nextAction.trim()) return { status: "invalid", errors: ["Next action is required."] };
  if (!form.nextActionDeadline) return { status: "invalid", errors: ["Deadline is required."] };

  const input = toNormalizedInput(form);

  if (input.assignToUserId) {
    const owner = await prisma.user.findFirst({ where: { id: input.assignToUserId, companyId: session.companyId } });
    if (!owner) return { status: "invalid", errors: ["Selected salesperson not found."] };
  }

  const batch = await prisma.ingestionBatch.create({
    data: { companyId: session.companyId, source: input.source, triggeredById: session.userId, recordsReceived: 1 },
  });

  const result = await ingestLead(session.companyId, batch.id, input, session.userId, {
    forceCreateDespitePossibleDuplicate: forceCreate,
  });

  await prisma.ingestionBatch.update({
    where: { id: batch.id },
    data: {
      recordsCreated: result.status === "created" ? 1 : 0,
      duplicatesSkipped: result.status === "duplicate" ? 1 : 0,
      invalidRows: result.status === "invalid" ? 1 : 0,
    },
  });

  if (result.status === "created") {
    revalidateAfterIngestion();
    return { status: "created", leadId: result.leadId! };
  }
  if (result.status === "duplicate") {
    return { status: "duplicate", reason: result.reason!, matchedCustomerId: result.customerId };
  }
  return { status: "invalid", errors: result.errors ?? ["Could not create lead."] };
}

// ---------- CSV import ----------

export type CsvImportRow = {
  customerName: string;
  companyName?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  source: LeadSource;
  product?: string;
  quantity?: string;
  requirement?: string;
  estimatedValue?: number | null;
  assignToUserId?: string | null;
  receivedAt?: string | null;
  forceCreateDespitePossibleDuplicate?: boolean;
};

export type CsvImportRowResult = {
  index: number;
  status: "created" | "duplicate" | "invalid";
  reason?: string;
  customerName: string;
};

export type CsvImportSummary = {
  batchId: string;
  received: number;
  created: number;
  duplicates: number;
  invalid: number;
  rows: CsvImportRowResult[];
};

/**
 * Server-side re-validation and re-import of the rows the user confirmed in
 * the CSV wizard's preview step. The client's preview classification (valid/
 * invalid/possible-duplicate) is UX only — every row is re-checked here
 * through the exact same ingestLead() pipeline manual entry uses, since the
 * client is never trusted for correctness or tenant isolation.
 */
export async function importCsvLeads(fileName: string, defaultSource: LeadSource, rows: CsvImportRow[]): Promise<CsvImportSummary> {
  const session = await requireSession();
  if (rows.length === 0) throw new Error("No rows to import.");
  if (rows.length > 2000) throw new Error("CSV import is limited to 2000 rows at a time.");

  const assignIds = [...new Set(rows.map((r) => r.assignToUserId).filter((v): v is string => !!v))];
  const validUsers = assignIds.length
    ? await prisma.user.findMany({ where: { id: { in: assignIds }, companyId: session.companyId }, select: { id: true } })
    : [];
  const validUserIds = new Set(validUsers.map((u) => u.id));

  const batch = await prisma.ingestionBatch.create({
    data: { companyId: session.companyId, source: defaultSource, triggeredById: session.userId, fileName, recordsReceived: rows.length },
  });

  let created = 0;
  let duplicates = 0;
  let invalid = 0;
  const results: CsvImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const customerName = row.customerName?.trim() ?? "";
    const input: NormalizedLeadInput = {
      source: row.source,
      customerName,
      companyName: row.companyName?.trim() || null,
      phone: row.phone?.trim() || null,
      email: row.email?.trim() || null,
      city: row.city?.trim() || null,
      state: row.state?.trim() || null,
      requirement: row.requirement?.trim() || null,
      product: row.product?.trim() || null,
      quantity: row.quantity?.trim() || null,
      estimatedValue: row.estimatedValue ?? null,
      assignToUserId: row.assignToUserId && validUserIds.has(row.assignToUserId) ? row.assignToUserId : null,
      receivedAt: row.receivedAt ? new Date(row.receivedAt) : undefined,
      rawData: JSON.stringify(row),
    };

    const result = await ingestLead(session.companyId, batch.id, input, session.userId, {
      forceCreateDespitePossibleDuplicate: row.forceCreateDespitePossibleDuplicate ?? false,
    });

    if (result.status === "created") created++;
    else if (result.status === "duplicate") duplicates++;
    else invalid++;

    results.push({ index: i, status: result.status, reason: result.reason ?? result.errors?.join("; "), customerName });
  }

  await prisma.ingestionBatch.update({
    where: { id: batch.id },
    data: { recordsCreated: created, duplicatesSkipped: duplicates, invalidRows: invalid },
  });

  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: "CSV_IMPORT_COMPLETED",
      entityType: "IngestionBatch",
      entityId: batch.id,
      metadata: JSON.stringify({ fileName, received: rows.length, created, duplicates, invalid }),
    },
  });

  revalidateAfterIngestion();

  return { batchId: batch.id, received: rows.length, created, duplicates, invalid, rows: results };
}

// ---------- Duplicate-check support for the CSV preview ----------

export type ExistingContact = {
  customerId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  recentActiveLeadTitle: string | null;
};

const RECENT_WINDOW_DAYS = 3;

/**
 * One fetch the CSV wizard uses to mirror the server's own possible-
 * duplicate heuristic (src/server/ingestion/duplicates.ts) locally while the
 * user is still mapping/previewing — so the "Possible Duplicate" flags they
 * see before confirming match what actually happens on import.
 */
export async function getExistingContactsForImportPreview(): Promise<ExistingContact[]> {
  const session = await requireSession();
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const customers = await prisma.customer.findMany({
    where: { companyId: session.companyId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      leads: {
        where: { status: { notIn: ["WON", "LOST"] }, createdAt: { gte: since } },
        select: { title: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return customers.map((c) => ({
    customerId: c.id,
    customerName: c.name,
    phone: c.phone,
    email: c.email,
    recentActiveLeadTitle: c.leads[0]?.title ?? null,
  }));
}
