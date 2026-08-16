import { prisma } from "@/lib/prisma";
import { notifyNewLeadAssigned } from "@/server/data/notifications";
import { validateNormalizedLead } from "./validate";
import { checkForDuplicate } from "./duplicates";
import { enrichIngestionInputWithAi } from "@/server/ai/features/enrichIngestion";
import type { NormalizedLeadInput, IngestResult } from "./types";

function deriveLeadTitle(input: NormalizedLeadInput): string {
  if (input.requirement && input.requirement.trim()) return input.requirement.trim().slice(0, 120);
  if (input.product && input.product.trim()) return `Enquiry: ${input.product.trim()}`.slice(0, 120);
  return `Enquiry from ${input.customerName}`.slice(0, 120);
}

/**
 * Find-or-create the customer this enquiry belongs to. A match is filled in
 * with any details the existing record is missing (never overwritten) —
 * "update," not "replace," per the ingestion pipeline's Create/Update
 * Customer step.
 */
async function findOrCreateCustomer(companyId: string, input: NormalizedLeadInput, matchedCustomerId?: string) {
  const existing = matchedCustomerId ? await prisma.customer.findFirst({ where: { id: matchedCustomerId, companyId } }) : null;

  if (existing) {
    const fill: Record<string, string> = {};
    if (!existing.phone && input.phone) fill.phone = input.phone;
    if (!existing.email && input.email) fill.email = input.email;
    if (!existing.city && input.city) fill.city = input.city;
    if (!existing.state && input.state) fill.state = input.state;
    if (!existing.companyName && input.companyName) fill.companyName = input.companyName;
    if (Object.keys(fill).length > 0) {
      await prisma.customer.update({ where: { id: existing.id }, data: fill });
    }
    return existing;
  }

  return prisma.customer.create({
    data: {
      companyId,
      name: input.customerName,
      companyName: input.companyName || null,
      phone: input.phone || null,
      email: input.email || null,
      city: input.city || null,
      state: input.state || null,
    },
  });
}

async function recordIngestion(
  batchId: string,
  companyId: string,
  input: NormalizedLeadInput,
  status: "CREATED" | "DUPLICATE" | "INVALID",
  extra: { reason?: string; leadId?: string; customerId?: string } = {}
) {
  await prisma.ingestionRecord.create({
    data: {
      batchId,
      companyId,
      source: input.source,
      externalLeadId: input.externalLeadId || null,
      customerName: input.customerName || null,
      companyName: input.companyName || null,
      phone: input.phone || null,
      email: input.email || null,
      city: input.city || null,
      state: input.state || null,
      requirement: input.requirement || null,
      product: input.product || null,
      quantity: input.quantity || null,
      estimatedValue: input.estimatedValue ?? null,
      receivedAt: input.receivedAt ?? new Date(),
      rawData: input.rawData || null,
      status,
      reason: extra.reason || null,
      leadId: extra.leadId || null,
      customerId: extra.customerId || null,
    },
  });
}

/**
 * The single, provider-independent path from a normalized enquiry to a real
 * Lead: optional AI enrichment (off by default — see enrichIngestion.ts) ->
 * validate -> detect duplicate -> create/update customer -> create lead ->
 * assign workflow -> log activity -> notify. Every source (manual entry,
 * CSV rows, and eventually real connectors/webhooks) funnels through this
 * exact function — nothing writes to Lead/Customer any other way.
 */
export async function ingestLead(
  companyId: string,
  batchId: string,
  rawInput: NormalizedLeadInput,
  actingUserId: string | null,
  opts: { forceCreateDespitePossibleDuplicate?: boolean } = {}
): Promise<IngestResult> {
  const input = await enrichIngestionInputWithAi(companyId, rawInput);

  const errors = validateNormalizedLead(input);
  if (errors.length > 0) {
    await recordIngestion(batchId, companyId, input, "INVALID", { reason: errors.join("; ") });
    return { status: "invalid", errors };
  }

  const dup = await checkForDuplicate(companyId, input);
  if (dup.kind === "exact") {
    await recordIngestion(batchId, companyId, input, "DUPLICATE", { reason: dup.reason });
    return { status: "duplicate", reason: dup.reason };
  }
  if (dup.kind === "possible" && !opts.forceCreateDespitePossibleDuplicate) {
    await recordIngestion(batchId, companyId, input, "DUPLICATE", { reason: dup.reason, customerId: dup.matchedCustomerId });
    return { status: "duplicate", reason: dup.reason, customerId: dup.matchedCustomerId };
  }

  const matchedCustomerId = dup.kind === "possible" ? dup.matchedCustomerId : undefined;
  const customer = await findOrCreateCustomer(companyId, input, matchedCustomerId);

  const lead = await prisma.lead.create({
    data: {
      companyId,
      customerId: customer.id,
      ownerId: input.assignToUserId || null,
      source: input.source,
      status: "NEW",
      priority: input.priority || "MEDIUM",
      title: deriveLeadTitle(input),
      description: input.requirement || null,
      product: input.product || null,
      quantity: input.quantity || null,
      estimatedValue: input.estimatedValue ?? null,
      nextAction: input.nextAction || null,
      nextActionDeadline: input.nextActionDeadline || null,
      createdAt: input.receivedAt ?? new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      leadId: lead.id,
      userId: actingUserId,
      type: "NOTE",
      notes: `Enquiry received via ${input.source === "MANUAL" ? "manual entry" : input.source === "CSV_IMPORT" ? "CSV import" : input.source}.`,
    },
  });

  if (lead.ownerId) {
    await notifyNewLeadAssigned(companyId, lead.id, lead.title, lead.ownerId);
  }

  await recordIngestion(batchId, companyId, input, "CREATED", { leadId: lead.id, customerId: customer.id });

  return { status: "created", leadId: lead.id, customerId: customer.id };
}
