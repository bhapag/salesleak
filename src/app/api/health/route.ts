import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Minimal production-safe health check — confirms the app is running and
 * can reach the database. Deliberately returns nothing beyond a status:
 * no connection string, no env vars, no customer data, no stack traces.
 *
 * This route is also the target of the daily Vercel Cron job in
 * vercel.json. The `SELECT 1` below is real database traffic, which is the
 * point: a Supabase free-tier project auto-pauses after a stretch of
 * inactivity, and that is exactly what took production down once already.
 *
 * That cron is a MITIGATION, NOT A FIX. It only keeps the project warm; it
 * does nothing for backups, and it will not save the database if the daily
 * ping itself fails while nobody is watching. The real remedy is a paid
 * Supabase tier with automatic backups and no inactivity pausing, which is
 * a human decision about money, not something the application can solve.
 *
 * Nothing here is privileged, so the cron needs no secret and this stays a
 * safe endpoint to expose: it reads a constant and returns a status.
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
