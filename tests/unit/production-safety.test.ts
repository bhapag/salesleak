import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { db } from "../helpers/setup";
import { ALPHA } from "../helpers/fixtures";

/**
 * The guard that makes the rest of the suite safe to run anywhere, including
 * CI and a developer laptop with real credentials in their shell.
 *
 * If someone removes the `@/lib/prisma` mock from tests/helpers/setup.ts, the
 * real PrismaClient would be constructed from DATABASE_URL and the isolation
 * tests would start writing to whatever database that points at. These
 * assertions fail loudly first.
 */
describe("production safety", () => {
  it("the client used by application code is the in-memory fake", () => {
    expect((prisma as unknown as { __isFakeDb?: boolean }).__isFakeDb).toBe(true);
  });

  it("no real Prisma client is present — there is nothing to connect with", () => {
    const client = prisma as unknown as Record<string, unknown>;
    expect(client.$connect).toBeUndefined();
    expect(client.$disconnect).toBeUndefined();
    expect(client instanceof Object).toBe(true);
  });

  it("writes land in the in-memory store, never over a network", async () => {
    const before = db.all("activity").length;

    await (prisma as unknown as { activity: { create: (a: unknown) => Promise<unknown> } }).activity.create({
      data: { leadId: ALPHA.leadId, userId: ALPHA.ownerId, type: "NOTE", notes: "local only" },
    });

    expect(db.all("activity")).toHaveLength(before + 1);
  });

  it("each test starts from the same fixture, so runs are deterministic", () => {
    expect(db.all("company")).toHaveLength(2);
    expect(db.all("lead")).toHaveLength(2);
    // The write from the previous test is gone — state does not leak between tests.
    expect(db.all("activity")).toHaveLength(0);
  });
});
