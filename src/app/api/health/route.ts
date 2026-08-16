import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Minimal production-safe health check — confirms the app is running and
 * can reach the database. Deliberately returns nothing beyond a status:
 * no connection string, no env vars, no customer data, no stack traces.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    logger.databaseFailure("Health check database query failed.", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
