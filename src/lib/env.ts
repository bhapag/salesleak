/**
 * Server-side environment validation. Deliberately NOT imported by
 * src/lib/prisma.ts or any other module Next.js touches while collecting
 * build-time page data — validating eagerly there fails `next build` itself
 * rather than a real request. This is called from src/instrumentation.ts's
 * register(), which only runs once a server instance actually starts.
 */

export type EnvCheckResult = { ok: boolean; errors: string[] };

const POSTGRES_URL_RE = /^postgres(ql)?:\/\//;

/** Required in every environment — the app cannot serve a single request without a database. */
function checkDatabaseUrl(): string[] {
  const url = process.env.DATABASE_URL;
  if (!url) return ["DATABASE_URL is not set. Copy .env.example to .env and fill in a PostgreSQL connection string."];
  if (!POSTGRES_URL_RE.test(url)) return ["DATABASE_URL does not look like a PostgreSQL connection string (expected it to start with postgres:// or postgresql://)."];
  return [];
}

/** Optional, but if set at all both must be present and sane — a half-configured AI provider is worse than none. */
function checkAiProvider(): string[] {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return []; // unset -> every AI feature runs in mock mode, which is a fully supported state
  if (key.trim().length < 10) return ["ANTHROPIC_API_KEY is set but looks too short to be a real key."];
  return [];
}

export function validateEnv(): EnvCheckResult {
  const errors = [...checkDatabaseUrl(), ...checkAiProvider()];
  return { ok: errors.length === 0, errors };
}
