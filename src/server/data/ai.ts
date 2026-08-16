import { prisma } from "@/lib/prisma";
import type { AiInsightKind } from "@/generated/prisma/client";

/**
 * One cached row per (company, kind, entity) — cost control lives here: a
 * caller compares the entity's current sourceVersion against the cached
 * row's before deciding whether to spend an AI call at all. See
 * src/server/actions/ai.ts for the compare-and-generate logic; this module
 * is just tenant-scoped storage.
 */
export async function getCachedInsight(companyId: string, kind: AiInsightKind, entityType: string, entityId: string) {
  return prisma.aiInsight.findFirst({ where: { companyId, kind, entityType, entityId } });
}

export async function upsertInsight(params: {
  companyId: string;
  kind: AiInsightKind;
  entityType: string;
  entityId: string;
  content: string;
  sourceVersion: string;
  mocked: boolean;
  provider?: string | null;
  model?: string | null;
}) {
  return prisma.aiInsight.upsert({
    where: {
      companyId_kind_entityType_entityId: {
        companyId: params.companyId,
        kind: params.kind,
        entityType: params.entityType,
        entityId: params.entityId,
      },
    },
    create: {
      companyId: params.companyId,
      kind: params.kind,
      entityType: params.entityType,
      entityId: params.entityId,
      content: params.content,
      sourceVersion: params.sourceVersion,
      mocked: params.mocked,
      provider: params.provider ?? null,
      model: params.model ?? null,
    },
    update: {
      content: params.content,
      sourceVersion: params.sourceVersion,
      mocked: params.mocked,
      provider: params.provider ?? null,
      model: params.model ?? null,
    },
  });
}
