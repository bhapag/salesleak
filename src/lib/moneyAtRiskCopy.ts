/**
 * The Dashboard's Money at Risk card reassures the user in words, not just a
 * ₹0 figure. That reassurance must never claim things are fine when they
 * aren't: totalAtRiskValue can legitimately be ₹0 (e.g. an opportunity with
 * no estimatedValue) while Attention Required still lists it — a lead with
 * no next action set is exactly the kind of missed follow-up this product
 * exists to catch, whether or not it carries a rupee figure yet.
 *
 * Pulled out of the page component so this — the one place the card can lie
 * — is unit-testable without rendering the Dashboard or hitting the database.
 */
export function getMoneyAtRiskMessage(totalAtRiskValue: number, attentionCount: number): string {
  if (totalAtRiskValue !== 0) {
    return "Revenue tied to leads or quotations that need action right now.";
  }
  if (attentionCount === 0) {
    return "Nothing at risk right now — every active lead and open quotation is on track.";
  }
  const noun = attentionCount === 1 ? "opportunity" : "opportunities";
  const verb = attentionCount === 1 ? "needs" : "need";
  return `No quantified value is at risk right now, but ${attentionCount} ${noun} still ${verb} attention.`;
}
