"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { IntegrationType } from "@/generated/prisma/client";
import { requireSession } from "@/server/auth/session";
import { canManageTeam, ForbiddenError } from "@/server/auth/permissions";
import { generateWebhookToken, generateSigningSecret } from "@/server/ingestion/security";
import { getAdapterByType } from "@/server/ingestion/connectors/registry";
import { processProviderPayload } from "@/server/ingestion/webhookHandler";
import type { NormalizedLeadInput } from "@/server/ingestion/types";
import { ingestLead } from "@/server/ingestion/pipeline";

function revalidateIntegrations() {
  revalidatePath("/settings/integrations");
}

async function requireIntegration(companyId: string, type: IntegrationType) {
  const integration = await prisma.integration.findFirst({ where: { companyId, type } });
  if (!integration) throw new ForbiddenError();
  return integration;
}

/**
 * Sets up (or re-sets-up) a connector's webhook: generates a fresh token and
 * puts it in the right "so it can actually be tested" state. IndiaMART can
 * never claim CONNECTED this phase (no real credentials/access) — it always
 * lands in TEST_MODE, per the phase's explicit labeling requirement.
 */
export async function generateWebhookConfig(type: IntegrationType): Promise<{ webhookUrl: string }> {
  const session = await requireSession();
  if (!canManageTeam(session.role)) throw new ForbiddenError("Only the Owner and Sales Managers can configure integrations.");

  const adapter = getAdapterByType(type);
  if (!adapter) throw new Error("This connector doesn't support webhook setup yet.");

  const integration = await requireIntegration(session.companyId, type);
  const token = integration.webhookToken ?? generateWebhookToken();
  const status = type === "INDIAMART" ? "TEST_MODE" : "CONNECTED";

  await prisma.integration.update({
    where: { id: integration.id },
    data: { webhookToken: token, enabled: true, status },
  });

  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: "INTEGRATION_CONFIGURED",
      entityType: "Integration",
      entityId: integration.id,
      metadata: JSON.stringify({ type, status }),
    },
  });

  revalidateIntegrations();
  return { webhookUrl: `/api/webhooks/${adapter.slug}/${token}` };
}

/** Returns the new secret in plaintext exactly once — the UI shows it in a one-time "copy now" banner, then only ever masks it. */
export async function regenerateSigningSecret(type: IntegrationType): Promise<{ signingSecret: string }> {
  const session = await requireSession();
  if (!canManageTeam(session.role)) throw new ForbiddenError("Only the Owner and Sales Managers can configure integrations.");

  const integration = await requireIntegration(session.companyId, type);
  const signingSecret = generateSigningSecret();
  await prisma.integration.update({ where: { id: integration.id }, data: { signingSecret } });

  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: "INTEGRATION_SECRET_REGENERATED",
      entityType: "Integration",
      entityId: integration.id,
      metadata: JSON.stringify({ type }),
    },
  });

  revalidateIntegrations();
  return { signingSecret };
}

export async function toggleIntegrationEnabled(type: IntegrationType, enabled: boolean): Promise<void> {
  const session = await requireSession();
  if (!canManageTeam(session.role)) throw new ForbiddenError("Only the Owner and Sales Managers can configure integrations.");

  const integration = await requireIntegration(session.companyId, type);
  await prisma.integration.update({ where: { id: integration.id }, data: { enabled } });

  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: "INTEGRATION_TOGGLED",
      entityType: "Integration",
      entityId: integration.id,
      metadata: JSON.stringify({ type, enabled }),
    },
  });

  revalidateIntegrations();
}

export type TestPayloadResult = {
  rawPayload: unknown;
  normalized: NormalizedLeadInput | null;
  parseError: string | null;
  outcome: { httpStatus: number; body: Record<string, unknown> } | null;
};

/**
 * Exercises the exact same parse -> ingest path a real webhook call would,
 * against a realistic sample payload, entirely within an authenticated
 * request — no HTTP round trip, no token/signature involved (the caller is
 * already a verified user of this company). Always shows the normalized
 * preview even when ingestion itself fails or flags a duplicate.
 */
export async function sendTestPayload(type: IntegrationType): Promise<TestPayloadResult> {
  const session = await requireSession();
  if (!canManageTeam(session.role)) throw new ForbiddenError("Only the Owner and Sales Managers can test integrations.");

  const adapter = getAdapterByType(type);
  if (!adapter) throw new Error("This connector doesn't support test payloads.");

  const integration = await requireIntegration(session.companyId, type);
  const rawPayload = adapter.samplePayload();
  const parsed = adapter.parse(rawPayload);

  if (!parsed.ok) {
    revalidateIntegrations();
    return { rawPayload, normalized: null, parseError: parsed.error, outcome: null };
  }

  const outcome = await processProviderPayload(
    { id: session.companyId },
    { id: integration.id, type: integration.type, enabled: integration.enabled },
    adapter,
    JSON.stringify(rawPayload)
  );

  revalidateIntegrations();
  return { rawPayload, normalized: parsed.input, parseError: null, outcome };
}

// ---------- Failed ingestion queue ----------

function hydrateNormalizedInput(json: string | null): Partial<NormalizedLeadInput> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as NormalizedLeadInput;
    return {
      ...parsed,
      receivedAt: parsed.receivedAt ? new Date(parsed.receivedAt) : undefined,
      nextActionDeadline: parsed.nextActionDeadline ? new Date(parsed.nextActionDeadline) : undefined,
    };
  } catch {
    return {};
  }
}

export type FailedIngestionCorrections = {
  customerName: string;
  phone?: string;
  email?: string;
  product?: string;
  requirement?: string;
  estimatedValue?: string;
};

export async function retryFailedIngestion(
  id: string,
  corrections: FailedIngestionCorrections
): Promise<{ status: "created" | "duplicate" | "invalid"; errors?: string[] }> {
  const session = await requireSession();
  if (!canManageTeam(session.role)) throw new ForbiddenError("Only the Owner and Sales Managers can retry failed imports.");

  const failure = await prisma.failedIngestion.findFirst({ where: { id, companyId: session.companyId } });
  if (!failure) throw new ForbiddenError();

  const base = hydrateNormalizedInput(failure.normalizedPayload);
  const value = corrections.estimatedValue?.trim();

  const input: NormalizedLeadInput = {
    source: failure.provider,
    ...base,
    customerName: corrections.customerName.trim(),
    phone: corrections.phone?.trim() || base.phone || null,
    email: corrections.email?.trim() || base.email || null,
    product: corrections.product?.trim() || base.product || null,
    requirement: corrections.requirement?.trim() || base.requirement || null,
    estimatedValue: value ? Number(value) : (base.estimatedValue ?? null),
  };

  const batch = await prisma.ingestionBatch.create({
    data: { companyId: session.companyId, source: failure.provider, triggeredById: session.userId, recordsReceived: 1 },
  });

  const result = await ingestLead(session.companyId, batch.id, input, session.userId, {
    forceCreateDespitePossibleDuplicate: true,
  });

  await prisma.ingestionBatch.update({
    where: { id: batch.id },
    data: {
      recordsCreated: result.status === "created" ? 1 : 0,
      duplicatesSkipped: result.status === "duplicate" ? 1 : 0,
      invalidRows: result.status === "invalid" ? 1 : 0,
    },
  });

  if (result.status === "created" || result.status === "duplicate") {
    await prisma.failedIngestion.update({
      where: { id },
      data: {
        status: "RESOLVED",
        retryCount: { increment: 1 },
        resolvedLeadId: result.leadId ?? null,
        resolvedAt: new Date(),
      },
    });
  } else {
    await prisma.failedIngestion.update({
      where: { id },
      data: { status: "PENDING", retryCount: { increment: 1 }, errorMessage: (result.errors ?? []).join("; ") || failure.errorMessage },
    });
  }

  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: "FAILED_INGESTION_RETRIED",
      entityType: "FailedIngestion",
      entityId: id,
      metadata: JSON.stringify({ provider: failure.provider, outcome: result.status }),
    },
  });

  revalidateIntegrations();
  return { status: result.status, errors: result.errors };
}

export async function dismissFailedIngestion(id: string): Promise<void> {
  const session = await requireSession();
  if (!canManageTeam(session.role)) throw new ForbiddenError("Only the Owner and Sales Managers can dismiss failed imports.");

  const failure = await prisma.failedIngestion.findFirst({ where: { id, companyId: session.companyId } });
  if (!failure) throw new ForbiddenError();

  await prisma.failedIngestion.update({ where: { id }, data: { status: "DISMISSED" } });

  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: "FAILED_INGESTION_DISMISSED",
      entityType: "FailedIngestion",
      entityId: id,
      metadata: JSON.stringify({ provider: failure.provider }),
    },
  });

  revalidateIntegrations();
}
