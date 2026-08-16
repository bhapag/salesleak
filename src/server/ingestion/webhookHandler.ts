import { prisma } from "@/lib/prisma";
import type { LeadSource } from "@/generated/prisma/client";
import { ingestLead } from "./pipeline";
import { getAdapterBySlug } from "./connectors/registry";
import type { ProviderAdapter } from "./connectors/types";
import { verifyHmacSignature, checkRateLimit } from "./security";

export type WebhookHandlerResult = {
  httpStatus: number;
  body: Record<string, unknown>;
};

/**
 * IntegrationType and LeadSource are kept in lockstep by name for every
 * connector-eligible value (INDIAMART, WEBSITE, EMAIL, ...) — this cast is
 * the one place that assumption is made explicit, rather than repeating a
 * string union mapping table that would just drift out of sync with the
 * schema.
 */
function asLeadSource(type: ProviderAdapter["type"]): LeadSource {
  return type as unknown as LeadSource;
}

/**
 * The shared core: parse the raw payload through the provider's adapter,
 * run it through the same ingestLead() pipeline every other source uses,
 * and record the outcome (batch counters, Integration monitoring fields,
 * and — critically — a FailedIngestion row whenever the payload could not
 * become a lead, so nothing is silently discarded). Used by both the real
 * webhook route (after token/signature/rate-limit checks) and the
 * authenticated in-app test console (which skips those checks since the
 * caller is already a verified user of the company being tested).
 */
export async function processProviderPayload(
  company: { id: string },
  integration: { id: string; type: ProviderAdapter["type"]; enabled: boolean },
  adapter: ProviderAdapter,
  rawBodyText: string
): Promise<WebhookHandlerResult> {
  if (!integration.enabled) {
    return { httpStatus: 403, body: { error: "This integration is currently disabled." } };
  }

  const now = new Date();
  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBodyText);
  } catch {
    await prisma.failedIngestion.create({
      data: {
        companyId: company.id,
        provider: asLeadSource(adapter.type),
        rawPayload: rawBodyText.slice(0, 20_000),
        errorMessage: "Payload is not valid JSON.",
      },
    });
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: now, lastError: "Payload is not valid JSON.", totalReceived: { increment: 1 } },
    });
    return { httpStatus: 400, body: { error: "Payload is not valid JSON." } };
  }

  const parsed = adapter.parse(rawPayload);
  const batch = await prisma.ingestionBatch.create({
    data: { companyId: company.id, source: asLeadSource(adapter.type), recordsReceived: 1 },
  });

  if (!parsed.ok) {
    await prisma.failedIngestion.create({
      data: {
        companyId: company.id,
        provider: asLeadSource(adapter.type),
        rawPayload: JSON.stringify(rawPayload).slice(0, 20_000),
        errorMessage: parsed.error,
      },
    });
    await prisma.ingestionBatch.update({ where: { id: batch.id }, data: { invalidRows: 1, errorMessage: parsed.error } });
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: now, lastError: parsed.error, totalReceived: { increment: 1 } },
    });
    return { httpStatus: 400, body: { status: "invalid", error: parsed.error } };
  }

  const result = await ingestLead(company.id, batch.id, parsed.input, null);

  await prisma.ingestionBatch.update({
    where: { id: batch.id },
    data: {
      recordsCreated: result.status === "created" ? 1 : 0,
      duplicatesSkipped: result.status === "duplicate" ? 1 : 0,
      invalidRows: result.status === "invalid" ? 1 : 0,
    },
  });

  if (result.status === "invalid") {
    await prisma.failedIngestion.create({
      data: {
        companyId: company.id,
        provider: asLeadSource(adapter.type),
        rawPayload: JSON.stringify(rawPayload).slice(0, 20_000),
        normalizedPayload: JSON.stringify(parsed.input),
        errorMessage: (result.errors ?? ["Could not create a lead from this payload."]).join("; "),
      },
    });
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: now, lastError: result.errors?.join("; ") ?? "Invalid payload.", totalReceived: { increment: 1 } },
    });
    return { httpStatus: 400, body: { status: "invalid", errors: result.errors } };
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      lastSyncAt: now,
      lastSuccessAt: result.status === "created" ? now : undefined,
      lastError: null,
      totalReceived: { increment: 1 },
    },
  });

  if (result.status === "created") {
    return { httpStatus: 201, body: { status: "created", leadId: result.leadId } };
  }
  return { httpStatus: 200, body: { status: "duplicate", reason: result.reason } };
}

/**
 * The real HTTP entry point's logic, kept out of the route file so the
 * route handler itself stays a thin adapter over Request/Response. Resolves
 * the company from the webhook token alone (never from anything in the URL
 * that could name a company directly), enforces enabled/rate-limit/signature
 * checks, then delegates to processProviderPayload().
 */
export async function handleWebhookRequest(
  providerSlug: string,
  token: string,
  rawBodyText: string,
  headers: Headers
): Promise<WebhookHandlerResult> {
  const adapter = getAdapterBySlug(providerSlug);
  if (!adapter) {
    return { httpStatus: 404, body: { error: "Unknown provider." } };
  }

  if (!checkRateLimit(token)) {
    return { httpStatus: 429, body: { error: "Too many requests." } };
  }

  const integration = await prisma.integration.findFirst({
    where: { webhookToken: token, type: adapter.type },
  });
  if (!integration) {
    // Same response whether the token is wrong, revoked, or for the wrong
    // provider slug — never confirm a token's existence to an unauthenticated caller.
    return { httpStatus: 404, body: { error: "Not found." } };
  }

  if (integration.signingSecret) {
    const signature = headers.get("x-webhook-signature");
    if (!verifyHmacSignature(rawBodyText, signature, integration.signingSecret)) {
      return { httpStatus: 401, body: { error: "Invalid signature." } };
    }
  }

  return processProviderPayload({ id: integration.companyId }, integration, adapter, rawBodyText);
}
