import { describe, it, expect } from "vitest";
import { getMoneyAtRiskMessage } from "@/lib/moneyAtRiskCopy";

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
