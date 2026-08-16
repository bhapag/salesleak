// Prisma 7 CLI config (migrate/studio/seed). schema.prisma cannot declare
// url/directUrl itself (Prisma 7.9.1 hard-rejects both there) and this
// installed version's config datasource type only has a single `url` field
// — no directUrl. So the pooled-vs-direct split for Supabase is done by
// hand instead:
//   - The CLI (this file, via `url` below) always connects DIRECT
//     (DIRECT_URL, falling back to DATABASE_URL for a plain local Postgres
//     with no pooler in front of it) — migrations need a real prepared-
//     statement-capable connection, which a transaction-mode pooler can't
//     give it.
//   - The running app (src/lib/prisma.ts) connects through DATABASE_URL
//     directly via its own driver adapter, completely independent of this
//     file — that's the pooled connection, safe for many concurrent
//     short-lived serverless invocations.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
