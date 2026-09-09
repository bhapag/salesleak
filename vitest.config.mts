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
    // Production runs on Vercel, which is UTC. A timezone-dependent bug in
    // the IndiaMART connector (IST enquiry times parsed in the server's own
    // zone) passed on an IST developer machine and only showed up against
    // the deployed endpoint — so the suite pins the deployment's timezone
    // rather than inheriting whoever's laptop is running it.
    env: { TZ: "UTC" },
    // Each file gets a fresh module registry, so the per-file prisma/session
    // mocks below can't leak state between suites.
    isolate: true,
    restoreMocks: true,
  },
});
