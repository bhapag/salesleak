import { describe, it, expect } from "vitest";
import { assertSameCompany, canManageCompany, canManageTeam, getOwnerScope, ForbiddenError } from "@/server/auth/permissions";
import type { AuthSession } from "@/server/auth/session";
import type { UserRole } from "@/generated/prisma/client";

/**
 * These are the real functions with no substitution of any kind — the
 * primitives every server action builds its authorization on. If the role
 * matrix below ever changes, that change has to be deliberate.
 */
function sessionAs(role: UserRole, companyId = "company_alpha", userId = "user_1"): AuthSession {
  return { userId, name: "Test User", email: "test@example.test", role, companyId, companyName: "Alpha Polymers" };
}

const ALL_ROLES: UserRole[] = ["OWNER", "SALES_MANAGER", "SALESPERSON"];

describe("assertSameCompany", () => {
  it("permits a record belonging to the caller's company", () => {
    expect(() => assertSameCompany("company_alpha", sessionAs("SALESPERSON"))).not.toThrow();
  });

  it("throws ForbiddenError for a record from another company", () => {
    expect(() => assertSameCompany("company_beta", sessionAs("SALESPERSON"))).toThrow(ForbiddenError);
  });

  it("throws for every role — being an Owner does not grant cross-company access", () => {
    for (const role of ALL_ROLES) {
      expect(() => assertSameCompany("company_beta", sessionAs(role))).toThrow(ForbiddenError);
    }
  });

  it("does not leak the record's company in the error message", () => {
    try {
      assertSameCompany("company_beta", sessionAs("OWNER"));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenError);
      expect((e as Error).message).not.toContain("company_beta");
    }
  });
});

describe("canManageCompany — Owner-only operations", () => {
  it("allows only OWNER", () => {
    expect(canManageCompany("OWNER")).toBe(true);
    expect(canManageCompany("SALES_MANAGER")).toBe(false);
    expect(canManageCompany("SALESPERSON")).toBe(false);
  });
});

describe("canManageTeam — Owner and Sales Manager", () => {
  it("allows OWNER and SALES_MANAGER but not SALESPERSON", () => {
    expect(canManageTeam("OWNER")).toBe(true);
    expect(canManageTeam("SALES_MANAGER")).toBe(true);
    expect(canManageTeam("SALESPERSON")).toBe(false);
  });
});

describe("getOwnerScope — record visibility narrowing", () => {
  it("restricts a SALESPERSON to their own records", () => {
    expect(getOwnerScope(sessionAs("SALESPERSON", "company_alpha", "user_sales"))).toBe("user_sales");
  });

  it("does not narrow for OWNER or SALES_MANAGER", () => {
    expect(getOwnerScope(sessionAs("OWNER"))).toBeUndefined();
    expect(getOwnerScope(sessionAs("SALES_MANAGER"))).toBeUndefined();
  });

  it("never returns another user's id", () => {
    for (const role of ALL_ROLES) {
      const scope = getOwnerScope(sessionAs(role, "company_alpha", "user_self"));
      expect(scope === undefined || scope === "user_self").toBe(true);
    }
  });
});
