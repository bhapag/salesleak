import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getMoneyAtRiskMessage } from "@/lib/moneyAtRiskCopy";

const CANONICAL_ALL_CLEAR_PHRASE = "every active lead and open quotation is on track";

/** Reads a src/ file relative to the repo root, for the call-site scan below. */
function readSrcFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../src/${relativePath}`, import.meta.url)), "utf8");
}

/**
 * Regression coverage for a verified production defect: the Samrat Poly
 * Resins dashboard showed Money at Risk = ₹0 alongside "every active lead
 * and open quotation is on track", while Attention Required simultaneously
 * listed an opportunity with no next action set. ₹0 was mathematically
 * correct (that lead has no estimatedValue) — the reassurance sentence was
 * the lie.
 */
describe("getMoneyAtRiskMessage", () => {
  it("Case A — ₹0 at risk and nothing needing attention: positive reassurance", () => {
    expect(getMoneyAtRiskMessage(0, 0)).toBe(
      "Nothing at risk right now — every active lead and open quotation is on track."
    );
  });

  it("Case B — ₹0 at risk but one item needs attention: must not claim everything is on track", () => {
    const message = getMoneyAtRiskMessage(0, 1);
    expect(message).not.toContain("every active lead and open quotation is on track");
    expect(message).toBe("No quantified value is at risk right now, but 1 opportunity still needs attention.");
  });

  it("Case B — ₹0 at risk but several items need attention: plural form, count reflected", () => {
    const message = getMoneyAtRiskMessage(0, 3);
    expect(message).not.toContain("on track");
    expect(message).toBe("No quantified value is at risk right now, but 3 opportunities still need attention.");
  });

  it("non-zero Money at Risk: unchanged regardless of attention count", () => {
    expect(getMoneyAtRiskMessage(50000, 0)).toBe("Revenue tied to leads or quotations that need action right now.");
    expect(getMoneyAtRiskMessage(50000, 4)).toBe("Revenue tied to leads or quotations that need action right now.");
  });

  it("never claims 'on track' when attention items exist, at any risk value", () => {
    for (const value of [0, 1, 50000]) {
      for (const count of [1, 2, 5]) {
        expect(getMoneyAtRiskMessage(value, count)).not.toMatch(/on track/i);
      }
    }
  });
});

/**
 * The helper above being correct isn't enough on its own — the Team member
 * detail page previously carried its own hand-written copy of the same
 * "everything is on track" claim, wired to its own locally-scoped
 * needsAttention list instead of this helper. It happened to be internally
 * consistent, but a second, independently maintained copy of the same claim
 * is exactly how the original Dashboard regression this file guards against
 * came to exist in the first place. These tests pin every known reassurance
 * call site to the one shared helper so that phrase can't be reintroduced as
 * a hardcoded literal anywhere else.
 */
describe("Money at Risk reassurance — call-site invariant", () => {
  it("the canonical all-clear phrase lives in exactly one place: moneyAtRiskCopy.ts", () => {
    const helperSource = readSrcFile("lib/moneyAtRiskCopy.ts");
    expect(helperSource).toContain(CANONICAL_ALL_CLEAR_PHRASE);
  });

  it("Dashboard routes its reassurance copy through getMoneyAtRiskMessage, not a hardcoded literal", () => {
    const dashboardSource = readSrcFile("app/(app)/page.tsx");
    expect(dashboardSource).toContain("getMoneyAtRiskMessage(");
    expect(dashboardSource).not.toContain(CANONICAL_ALL_CLEAR_PHRASE);
  });

  it("Team member detail routes its reassurance copy through getMoneyAtRiskMessage, not a hardcoded literal", () => {
    const teamDetailSource = readSrcFile("app/(app)/team/[id]/page.tsx");
    expect(teamDetailSource).toContain("getMoneyAtRiskMessage(");
    expect(teamDetailSource).not.toContain(CANONICAL_ALL_CLEAR_PHRASE);
  });

  it("Team member detail passes its own salesperson-scoped attention count, not a global one", () => {
    const teamDetailSource = readSrcFile("app/(app)/team/[id]/page.tsx");
    expect(teamDetailSource).toContain("getMoneyAtRiskMessage(moneyAtRisk, needsAttention.length)");
  });
});
