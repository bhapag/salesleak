/**
 * Everything the AI layer needs from a provider: turn a system+user prompt
 * into raw text believed to be JSON. Nothing about SalesLeak's business
 * logic lives here — that's in src/server/ai/features/*.ts, which use this
 * interface without knowing or caring which provider answered.
 */
export interface AIProvider {
  readonly name: string;
  /** Whether this provider has what it needs (an API key, etc.) to make real calls. */
  isConfigured(): boolean;
  generateJSON(params: { system: string; prompt: string; maxTokens?: number }): Promise<{
    text: string;
    usage?: { inputTokens?: number; outputTokens?: number };
  }>;
}

export type AIGenerateOutcome<T> = { ok: true; data: T; mocked: boolean } | { ok: false; error: string };
