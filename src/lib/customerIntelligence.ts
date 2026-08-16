/**
 * Rule-based customer intelligence — no AI. Mirrors leadRisk.ts/quotationRisk.ts:
 * pure functions that derive a signal from data rather than storing it, so the
 * rules live in one place and every page (list, detail, dashboard) agrees.
 *
 * Repeat-order detection is an ESTIMATE based on historical order spacing, not
 * a guarantee — every consumer of RepeatOrderSignal should present it as an
 * opportunity signal, never as a certainty.
 */

export type CustomerStatus = "Prospect" | "Active Customer" | "Repeat Customer" | "Dormant" | "Lost";

export type RepeatOrderStatus = "Normal" | "Due Soon" | "Repeat Order Due" | "Overdue / Dormant";

export type RepeatOrderSignal = {
  /** True only when there's enough order history (2+) to estimate a cadence. */
  eligible: boolean;
  status: RepeatOrderStatus;
  wonOrderCount: number;
  averageIntervalDays: number | null;
  daysSinceLastOrder: number | null;
  lastOrderDate: Date | null;
  /** Average value per historical won order — used to size the suggested opportunity. */
  estimatedOrderValue: number | null;
};

export type CustomerSignal = {
  key: string;
  label: string;
  severity: "critical" | "warning" | "info";
};

const DORMANT_DAYS = 60;
const HIGH_VALUE_THRESHOLD = 50000;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export type CustomerStatusInput = {
  hasActiveLead: boolean;
  wonCount: number;
  lostCount: number;
  totalLeads: number;
  lastTouchedAt: Date | null;
};

export function computeCustomerStatus(input: CustomerStatusInput, now: Date = new Date()): CustomerStatus {
  const { hasActiveLead, wonCount, lostCount, totalLeads, lastTouchedAt } = input;

  if (wonCount === 0 && totalLeads > 0 && lostCount === totalLeads && !hasActiveLead) {
    return "Lost";
  }
  if (wonCount === 0) {
    return "Prospect";
  }

  const daysSinceTouch = lastTouchedAt ? daysBetween(lastTouchedAt, now) : Infinity;
  if (!hasActiveLead && daysSinceTouch >= DORMANT_DAYS) {
    return "Dormant";
  }
  return wonCount >= 2 ? "Repeat Customer" : "Active Customer";
}

export type WonOrder = { wonAt: Date; value: number };

export function computeRepeatOrderSignal(wonOrders: WonOrder[], now: Date = new Date()): RepeatOrderSignal {
  const orders = [...wonOrders].sort((a, b) => a.wonAt.getTime() - b.wonAt.getTime());

  if (orders.length < 2) {
    const only = orders[0];
    return {
      eligible: false,
      status: "Normal",
      wonOrderCount: orders.length,
      averageIntervalDays: null,
      daysSinceLastOrder: only ? daysBetween(only.wonAt, now) : null,
      lastOrderDate: only ? only.wonAt : null,
      estimatedOrderValue: only ? only.value : null,
    };
  }

  const intervals: number[] = [];
  for (let i = 1; i < orders.length; i++) {
    intervals.push(daysBetween(orders[i - 1].wonAt, orders[i].wonAt));
  }
  const averageIntervalDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const lastOrderDate = orders[orders.length - 1].wonAt;
  const daysSinceLastOrder = daysBetween(lastOrderDate, now);
  const ratio = averageIntervalDays > 0 ? daysSinceLastOrder / averageIntervalDays : 0;

  let status: RepeatOrderStatus;
  if (ratio < 0.8) status = "Normal";
  else if (ratio < 1.0) status = "Due Soon";
  else if (ratio < 1.5) status = "Repeat Order Due";
  else status = "Overdue / Dormant";

  const estimatedOrderValue = orders.reduce((a, o) => a + o.value, 0) / orders.length;

  return { eligible: true, status, wonOrderCount: orders.length, averageIntervalDays, daysSinceLastOrder, lastOrderDate, estimatedOrderValue };
}

export type CustomerSignalInput = {
  customerStatus: CustomerStatus;
  repeatOrderSignal: RepeatOrderSignal;
  totalWonValue: number;
  hasOpenQuotationAtRisk: boolean;
  hasOverdueFollowUp: boolean;
  lostCount: number;
  hasActiveLeadMissingNextAction: boolean;
};

export function computeCustomerSignals(input: CustomerSignalInput): CustomerSignal[] {
  const signals: CustomerSignal[] = [];

  if (input.repeatOrderSignal.eligible && input.repeatOrderSignal.status === "Overdue / Dormant") {
    signals.push({ key: "repeat-overdue", label: "Overdue for a repeat order", severity: "critical" });
  } else if (input.repeatOrderSignal.eligible && input.repeatOrderSignal.status === "Repeat Order Due") {
    signals.push({ key: "repeat-due", label: "Repeat order likely due", severity: "warning" });
  }

  if (input.customerStatus === "Dormant" && input.totalWonValue >= HIGH_VALUE_THRESHOLD) {
    signals.push({ key: "high-value-inactive", label: "Previously high-value customer has gone inactive", severity: "critical" });
  }

  if (input.hasOpenQuotationAtRisk) {
    signals.push({ key: "quotation-followup", label: "Open quotation needs follow-up", severity: "warning" });
  }

  if (input.hasOverdueFollowUp) {
    signals.push({ key: "overdue-followup", label: "Overdue follow-up", severity: "critical" });
  }

  if (input.lostCount >= 2) {
    signals.push({ key: "multiple-lost", label: `${input.lostCount} lost opportunities`, severity: "info" });
  }

  if (input.hasActiveLeadMissingNextAction) {
    signals.push({ key: "no-next-action", label: "Active opportunity has no next action", severity: "warning" });
  }

  return signals;
}
