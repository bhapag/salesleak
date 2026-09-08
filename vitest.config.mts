import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Tests run in plain Node against an in-memory database substitute — never
 * against Postgres, Supabase, or any network service. See
 * tests/helpers/fakeDb.ts for why that still exercises real tenant
 * boundaries, and tests/helpers/testEnv.ts for the guard that fails the run
 * if the real Prisma client is ever imported.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    // Each file gets a fresh module registry, so the per-file prisma/session
    // mocks below can't leak state between suites.
    isolate: true,
    restoreMocks: true,
  },
});
