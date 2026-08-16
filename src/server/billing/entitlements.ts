import { prisma } from "@/lib/prisma";
import type { AuthSession } from "@/server/auth/session";
import type { SubscriptionPlan, SubscriptionStatus } from "@/generated/prisma/client";

export class SubscriptionRequiredError extends Error {
  constructor(message = "This workspace's subscription needs attention before you can make changes. Ask the Owner to check Billing.") {
    super(message);
    this.name = "SubscriptionRequiredError";
  }
}

export type EffectiveStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";

export type SubscriptionState = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  /** Trial expiry is derived here, not stored — a TRIAL row past its trialEnd is EXPIRED the moment anyone asks, same as lead/quotation risk being computed rather than cached. */
  effectiveStatus: EffectiveStatus;
  isReadOnly: boolean;
  trialEnd: Date | null;
  trialDaysRemaining: number | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The single source of truth for "is this company's subscription in good
 * standing." Every read of subscription state — the dashboard banner, the
 * billing page, and assertMutationAllowed below — goes through this one
 * function so they can never disagree.
 */
export async function getSubscriptionState(companyId: string): Promise<SubscriptionState> {
  const sub = await prisma.subscription.findUnique({ where: { companyId } });
  const now = new Date();

  // A missing row should be rare — every company gets one at signup, seed,
  // or the Phase 14 backfill — but must never silently lock a real company
  // out. Fail OPEN here (treat as good standing); the tenant-isolation
  // checks elsewhere in the app are what actually protects data, and those
  // fail closed as normal.
  if (!sub) {
    return {
      plan: "STARTER",
      status: "ACTIVE",
      effectiveStatus: "ACTIVE",
      isReadOnly: false,
      trialEnd: null,
      trialDaysRemaining: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }

  let effectiveStatus: EffectiveStatus = sub.status;
  if (sub.status === "TRIAL" && sub.trialEnd && sub.trialEnd.getTime() < now.getTime()) {
    effectiveStatus = "EXPIRED";
  }

  const trialDaysRemaining =
    sub.status === "TRIAL" && sub.trialEnd ? Math.max(0, Math.ceil((sub.trialEnd.getTime() - now.getTime()) / DAY_MS)) : null;

  return {
    plan: sub.plan,
    status: sub.status,
    effectiveStatus,
    isReadOnly: effectiveStatus === "EXPIRED" || effectiveStatus === "CANCELLED",
    trialEnd: sub.trialEnd,
    trialDaysRemaining,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}

/**
 * The one guard every mutating server action for core sales records
 * (leads/quotations/tasks/ingestion) calls, immediately after
 * requireSession() — same layering as getOwnedLead/getOwnedQuotation's
 * tenant-isolation check. This is what "centralize entitlement logic"
 * means here: one function with the actual rule, called consistently,
 * rather than each action re-deriving what counts as read-only.
 *
 * Data access (reads), billing/settings, and export are deliberately never
 * gated by this — a lapsed subscription must never lock a company out of
 * its own data.
 */
export async function assertMutationAllowed(session: AuthSession): Promise<void> {
  const state = await getSubscriptionState(session.companyId);
  if (state.isReadOnly) {
    throw new SubscriptionRequiredError();
  }
}
