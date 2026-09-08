import { describe, it, expect } from "vitest";
import { db, signInAs, signInWithSession, signOut, RedirectError } from "../helpers/setup";
import { ALPHA, BETA } from "../helpers/fixtures";
import { getSession, requireSession } from "@/server/auth/session";

/**
 * The session is where every downstream authorization decision gets its
 * companyId and role, so these run against the real session module and the
 * real Session rows — nothing about the identity is injected.
 */
describe("session resolution", () => {
  it("derives company and role from the stored session, not from the caller", async () => {
    signInAs(ALPHA.salespersonId);

    const session = await getSession();

    expect(session).not.toBeNull();
    expect(session?.userId).toBe(ALPHA.salespersonId);
    expect(session?.companyId).toBe(ALPHA.companyId);
    expect(session?.role).toBe("SALESPERSON");
    expect(session?.companyName).toBe("Alpha Polymers");
  });

  it("returns null when there is no session cookie", async () => {
    signOut();
    expect(await getSession()).toBeNull();
  });

  it("rejects a token that was never issued", async () => {
    // A cookie is present and well-formed, but no matching Session row exists.
    signInWithSession({
      id: "session_unrelated",
      userId: ALPHA.ownerId,
      token: "token_actually_issued",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    signInWithSession({
      id: "session_placeholder",
      userId: ALPHA.ownerId,
      token: "token_never_issued",
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    // Remove the row the cookie now points at, leaving a dangling token.
    const client = db.client() as { session: { deleteMany: (args: unknown) => Promise<unknown> } };
    await client.session.deleteMany({ where: { token: "token_never_issued" } });

    expect(await getSession()).toBeNull();
  });

  it("refuses an expired session and deletes it", async () => {
    signInWithSession({
      id: "session_expired",
      userId: ALPHA.ownerId,
      token: "token_expired",
      expiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date(),
    });

    expect(await getSession()).toBeNull();
    expect(db.all("session").some((s) => s.token === "token_expired")).toBe(false);
  });

  it("refuses a deactivated user's still-valid session", async () => {
    signInAs(ALPHA.salespersonId);
    expect(db.all("user").find((u) => u.id === ALPHA.salespersonId)?.isActive).toBe(true);

    // Deactivate directly in the store, as setUserActive would.
    const client = db.client() as { user: { update: (args: unknown) => Promise<unknown> } };
    await client.user.update({ where: { id: ALPHA.salespersonId }, data: { isActive: false } });

    expect(await getSession()).toBeNull();
  });

  it("requireSession redirects to /login when signed out", async () => {
    signOut();
    await expect(requireSession()).rejects.toBeInstanceOf(RedirectError);
  });

  it("a session belonging to Beta never resolves to Alpha's company", async () => {
    signInAs(BETA.salespersonId);

    const session = await getSession();

    expect(session?.companyId).toBe(BETA.companyId);
    expect(session?.companyId).not.toBe(ALPHA.companyId);
  });
});
