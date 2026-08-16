import type { QuotationStatus } from "@/generated/prisma/client";

/**
 * Quotation risk logic, mirroring src/lib/leadRisk.ts: a single place that
 * decides whether a quotation needs attention, and what status label to show.
 * "Follow-up Due" is never stored — it's derived from followUpDate vs now,
 * the same way lead overdue-ness is derived rather than stored.
 */

export type QuotationRiskInput = {
  status: QuotationStatus;
  value: number;
  sentAt: Date | null;
  followUpDate: Date | null;
  nextAction: string | null;
  updatedAt: Date;
};

export type QuotationDisplayStatus = "Draft" | "Sent" | "Follow-up Due" | "Negotiating" | "Won" | "Lost" | "Expired";

export type QuotationRisk = {
  isOpen: boolean;
  isOverdueFollowUp: boolean;
  missingNextAction: boolean;
  isStale: boolean;
  needsAttention: boolean;
  isHighValue: boolean;
  isHighRiskOpportunity: boolean;
  displayStatus: QuotationDisplayStatus;
  ageDays: number;
  reasons: string[];
};

const HIGH_VALUE_THRESHOLD = 50000;
const STALE_DAYS_THRESHOLD = 10;

export type QuotationRiskThresholds = { highValueThreshold?: number; staleDaysThreshold?: number };

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, QuotationDisplayStatus> = {
  DRAFT: "Draft",
  SENT: "Sent",
  FOLLOWED_UP: "Negotiating",
  ACCEPTED: "Won",
  REJECTED: "Lost",
  EXPIRED: "Expired",
};

export function getQuotationRisk(quotation: QuotationRiskInput, now: Date = new Date(), thresholds: QuotationRiskThresholds = {}): QuotationRisk {
  const highValueThreshold = thresholds.highValueThreshold ?? HIGH_VALUE_THRESHOLD;
  const staleDaysThreshold = thresholds.staleDaysThreshold ?? STALE_DAYS_THRESHOLD;

  const isOpen = quotation.status === "DRAFT" || quotation.status === "SENT" || quotation.status === "FOLLOWED_UP";
  const isSentOrLater = quotation.status !== "DRAFT";
  const isActionable = isOpen && isSentOrLater;

  const isOverdueFollowUp = isActionable && quotation.followUpDate != null && quotation.followUpDate < now;
  const missingNextAction = isActionable && !quotation.nextAction;
  const daysSinceUpdate = Math.floor((now.getTime() - quotation.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  const isStale = isActionable && daysSinceUpdate >= staleDaysThreshold;

  const reasons: string[] = [];
  if (isOverdueFollowUp) reasons.push("Follow-up deadline has passed");
  if (missingNextAction) reasons.push("No next action set");
  if (isStale) reasons.push(`No activity in ${daysSinceUpdate} days`);

  const needsAttention = reasons.length > 0;
  const isHighValue = quotation.value >= highValueThreshold;
  const isHighRiskOpportunity = needsAttention && isHighValue;

  const displayStatus: QuotationDisplayStatus =
    isActionable && isOverdueFollowUp ? "Follow-up Due" : QUOTATION_STATUS_LABEL[quotation.status];

  const ageStart = quotation.sentAt ?? quotation.updatedAt;
  const ageDays = Math.max(0, Math.floor((now.getTime() - ageStart.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    isOpen,
    isOverdueFollowUp,
    missingNextAction,
    isStale,
    needsAttention,
    isHighValue,
    isHighRiskOpportunity,
    displayStatus,
    ageDays,
    reasons,
  };
}
