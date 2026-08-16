import type { LeadStatus } from "@/generated/prisma/client";

/**
 * Core SalesLeak rule: every ACTIVE lead (not Won, not Lost) must have an
 * owner, a status, a next action, and a deadline. This is the single place
 * that decides whether a lead violates that rule — every page that shows
 * leads should derive its warnings from here instead of re-checking fields.
 */

export type LeadRiskInput = {
  status: LeadStatus;
  ownerId: string | null;
  nextAction: string | null;
  nextActionDeadline: Date | null;
  priority: string;
  estimatedValue: number | null;
  lastActivityAt: Date | null;
};

export type LeadRisk = {
  isActive: boolean;
  missingOwner: boolean;
  missingNextAction: boolean;
  missingDeadline: boolean;
  isOverdue: boolean;
  isUntouched: boolean;
  needsAttention: boolean;
  isHighRiskOpportunity: boolean;
  reasons: string[];
};

const HIGH_RISK_VALUE_THRESHOLD = 50000;

export function getLeadRisk(lead: LeadRiskInput, now: Date = new Date(), highValueThreshold: number = HIGH_RISK_VALUE_THRESHOLD): LeadRisk {
  const isActive = lead.status !== "WON" && lead.status !== "LOST";

  const missingOwner = isActive && !lead.ownerId;
  const missingNextAction = isActive && !lead.nextAction;
  const missingDeadline = isActive && !lead.nextActionDeadline;
  const isOverdue = isActive && lead.nextActionDeadline != null && lead.nextActionDeadline < now;
  const isUntouched = isActive && lead.lastActivityAt == null;

  const reasons: string[] = [];
  if (missingOwner) reasons.push("No owner assigned");
  if (missingNextAction) reasons.push("No next action set");
  if (missingDeadline) reasons.push("No deadline set");
  if (isOverdue) reasons.push("Next-action deadline has passed");
  if (isUntouched) reasons.push("Not contacted since it was created");

  const needsAttention = reasons.length > 0;
  const isValuable = lead.priority === "URGENT" || lead.priority === "HIGH" || (lead.estimatedValue ?? 0) >= highValueThreshold;
  const isHighRiskOpportunity = needsAttention && isValuable;

  return {
    isActive,
    missingOwner,
    missingNextAction,
    missingDeadline,
    isOverdue,
    isUntouched,
    needsAttention,
    isHighRiskOpportunity,
    reasons,
  };
}
