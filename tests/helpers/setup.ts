import { vi, beforeEach } from "vitest";
import { FakeDb } from "./fakeDb";
import { seedTwoTenants } from "./fixtures";

/**
 * Wires the application's server code to the in-memory store and to inert
 * Next.js request primitives. Registered as vitest `setupFiles`, so it runs
 * once per test file — no state is shared between files.
 *
 * The important property: `@/lib/prisma` is replaced here, so the real
 * PrismaClient module is never imported and no connection string is ever
 * read. A test physically cannot reach Postgres, Supabase, or any other
 * database. tests/unit/production-safety.test.ts asserts that.
 */
const holder = vi.hoisted(() => ({
  prisma: undefined as unknown,
  sessionToken: null as string | null,
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.prisma;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
  unstable_cache: (fn: unknown) => fn,
}));

/** Signals an attempted redirect (e.g. requireSession with no cookie) without unwinding into Next internals. */
export class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`REDIRECT:${url}`);
    this.name = "RedirectError";
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (holder.sessionToken ? { name, value: holder.sessionToken } : undefined),
    set: () => {},
    delete: () => {
      holder.sessionToken = null;
    },
  }),
}));

/**
 * `getSession` is wrapped in React's `cache()` for per-request dedup. Outside
 * a React request that memoization would persist across assertions within a
 * test, so switching the signed-in user mid-test would silently keep serving
 * the previous one. Reducing `cache` to a pass-through keeps every call a
 * real read of the store — the behaviour under test is the query scoping,
 * not the memoization.
 */
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

export const db = new FakeDb();
holder.prisma = db.client();

/** Signs in as a real seeded user by creating a real Session row and cookie. */
export function signInAs(userId: string): string {
  const token = `token_${userId}`;
  db.seed("session", [
    {
      id: `session_${userId}`,
      userId,
      token,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    },
  ]);
  holder.sessionToken = token;
  return token;
}

/** Signs in with a session row shaped however the test needs (expired, etc.). */
export function signInWithSession(row: Record<string, unknown>): void {
  db.seed("session", [row]);
  holder.sessionToken = row.token as string;
}

export function signOut(): void {
  holder.sessionToken = null;
}

beforeEach(() => {
  db.reset();
  holder.sessionToken = null;
  seedTwoTenants(db);
});
