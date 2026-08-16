import { prisma } from "@/lib/prisma";
import { anthropicProvider } from "./providers/anthropic";
import { validateObject, extractJson, type ObjectSchema } from "./schema";
import type { AIProvider, AIGenerateOutcome } from "./types";
import { logger } from "@/lib/logger";

/**
 * The one place a provider is chosen. Every feature module calls
 * generateStructured() below rather than talking to a provider directly, so
 * switching the active provider — or adding a second one and picking based
 * on config — never touches feature code.
 */
function getActiveProvider(): AIProvider {
  return anthropicProvider;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms.`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function logUsage(params: {
  companyId: string;
  feature: string;
  provider: string;
  mocked: boolean;
  success: boolean;
  latencyMs: number;
  errorMessage?: string;
}) {
  try {
    await prisma.aiUsageLog.create({
      data: {
        companyId: params.companyId,
        feature: params.feature,
        provider: params.provider,
        mocked: params.mocked,
        success: params.success,
        latencyMs: params.latencyMs,
        errorMessage: params.errorMessage?.slice(0, 500) ?? null,
      },
    });
  } catch (err) {
    // Usage logging is best-effort — never let a logging failure take down
    // an otherwise-successful (or already-failed) AI call. Still surfaced
    // via the logger so a struggling database doesn't fail silently.
    logger.databaseFailure("Failed to write AiUsageLog row.", {
      companyId: params.companyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export type GenerateStructuredParams<TInput, TOutput extends Record<string, unknown>> = {
  feature: string;
  companyId: string;
  input: TInput;
  buildPrompt: (input: TInput) => { system: string; prompt: string };
  schema: ObjectSchema;
  mockResult: (input: TInput) => TOutput;
  maxTokens?: number;
  timeoutMs?: number;
};

/**
 * The single entry point every AI feature uses. Two, and only two, ways
 * this can produce output:
 *
 * 1. No provider configured -> mockResult(input) runs immediately, no
 *    network call, clearly flagged `mocked: true`. This is development/test
 *    mode, and it is never disguised as a real AI answer.
 * 2. A provider is configured -> a real call is attempted, with a timeout,
 *    JSON extraction, and schema validation. If ANY of that fails, this
 *    returns an honest `{ ok: false }` — it does NOT silently fall back to
 *    mock data pretending to be real, and it does not fall back to mock
 *    data pretending the failure didn't happen. The caller decides how to
 *    show that failure (a plain "AI summary unavailable" state).
 *
 * Every call — mocked or real, success or failure — writes one AiUsageLog
 * row. Callers are responsible for their own result caching (AiInsight);
 * this function has no opinion about staleness.
 */
export async function generateStructured<TInput, TOutput extends Record<string, unknown>>(
  params: GenerateStructuredParams<TInput, TOutput>
): Promise<AIGenerateOutcome<TOutput>> {
  const provider = getActiveProvider();
  const timeoutMs = params.timeoutMs ?? 20_000;
  const startedAt = Date.now();

  if (!provider.isConfigured()) {
    const data = params.mockResult(params.input);
    await logUsage({
      companyId: params.companyId,
      feature: params.feature,
      provider: "mock",
      mocked: true,
      success: true,
      latencyMs: Date.now() - startedAt,
    });
    return { ok: true, data, mocked: true };
  }

  try {
    const { system, prompt } = params.buildPrompt(params.input);
    const result = await withTimeout(provider.generateJSON({ system, prompt, maxTokens: params.maxTokens }), timeoutMs);

    const extracted = extractJson(result.text);
    if (!extracted.ok) throw new Error(extracted.error);

    const validated = validateObject(extracted.value, params.schema);
    if (!validated.ok) throw new Error(validated.error);

    await logUsage({
      companyId: params.companyId,
      feature: params.feature,
      provider: provider.name,
      mocked: false,
      success: true,
      latencyMs: Date.now() - startedAt,
    });
    return { ok: true, data: validated.value as TOutput, mocked: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed.";
    logger.aiFailure(message, { companyId: params.companyId, feature: params.feature, provider: provider.name });
    await logUsage({
      companyId: params.companyId,
      feature: params.feature,
      provider: provider.name,
      mocked: false,
      success: false,
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
    });
    return { ok: false, error: message };
  }
}

export function isAiConfigured(): boolean {
  return getActiveProvider().isConfigured();
}
