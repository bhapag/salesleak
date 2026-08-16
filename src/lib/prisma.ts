import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Deliberately no eager "is DATABASE_URL set" throw here — this module is
// imported by pages Next.js touches while collecting build-time page data,
// before real env vars are necessarily available, and a throw there fails
// the build itself rather than a real request. The startup check that
// actually matters (a missing var should fail loudly before serving
// traffic) lives in src/instrumentation.ts's register(), which only runs
// when a server instance starts, never during `next build`.
// The pooled connection (safe for many short-lived serverless invocations).
// Migrations use DIRECT_URL instead — see prisma.config.ts.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
