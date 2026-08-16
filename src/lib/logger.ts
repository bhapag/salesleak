/**
 * Minimal structured server logging — plain JSON lines to stdout/stderr, no
 * paid monitoring service. Vercel (and any other host) captures process
 * stdout/stderr as logs automatically, so this is enough to actually see
 * failures without adding infrastructure.
 *
 * Never pass raw payloads, headers, or secrets into `meta` — see REDACT_KEYS
 * for the defensive strip applied regardless, but callers are the first
 * line of defense: build `meta` from named, whitelisted fields, the same
 * discipline already used for AI prompt inputs (see ARCHITECTURE.md).
 */

type LogCategory = "auth" | "database" | "ingestion" | "webhook" | "ai" | "server";

type LogMeta = Record<string, string | number | boolean | null | undefined>;

const REDACT_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "sessiontoken",
  "webhooktoken",
  "signingsecret",
  "secret",
  "apikey",
  "authorization",
  "cookie",
]);

function redact(meta: LogMeta | undefined): LogMeta | undefined {
  if (!meta) return meta;
  const clean: LogMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    clean[key] = REDACT_KEYS.has(key.toLowerCase()) ? "[redacted]" : value;
  }
  return clean;
}

function write(level: "error" | "warn", category: LogCategory, message: string, meta?: LogMeta) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    ...redact(meta),
  });
  if (level === "error") console.error(line);
  else console.warn(line);
}

export const logger = {
  authFailure: (message: string, meta?: LogMeta) => write("warn", "auth", message, meta),
  databaseFailure: (message: string, meta?: LogMeta) => write("error", "database", message, meta),
  ingestionFailure: (message: string, meta?: LogMeta) => write("warn", "ingestion", message, meta),
  webhookFailure: (message: string, meta?: LogMeta) => write("warn", "webhook", message, meta),
  aiFailure: (message: string, meta?: LogMeta) => write("warn", "ai", message, meta),
  serverError: (message: string, meta?: LogMeta) => write("error", "server", message, meta),
};
