import type { Instrumentation } from "next";

/**
 * Runs once when a server instance starts — never during `next build`, so
 * this is the safe place for "does the environment actually look usable"
 * checks that would otherwise fail the build itself (see src/lib/prisma.ts
 * for why that check doesn't live there).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { validateEnv } = await import("@/lib/env");
  const { logger } = await import("@/lib/logger");

  const result = validateEnv();
  for (const error of result.errors) {
    logger.serverError(error, { phase: "startup" });
  }

  // Missing/invalid required config is always worth crashing loudly on in
  // production — a deployment silently serving requests it can't fulfill
  // is worse than one that never came up. In development, warn and let the
  // developer keep working (e.g. wiring up a fresh checkout of the repo).
  if (!result.ok && process.env.NODE_ENV === "production") {
    throw new Error(`Server startup aborted: ${result.errors.join(" ")}`);
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { logger } = await import("@/lib/logger");
  const message = error instanceof Error ? error.message : String(error);
  logger.serverError(message, {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
};
