"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth/session";
import { canManageCompany, ForbiddenError } from "@/server/auth/permissions";
import { getActiveBillingProvider } from "@/server/billing/client";
import { getAppBaseUrl } from "@/lib/appUrl";
import { revalidatePath } from "next/cache";

export type CheckoutActionResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Owner-only, self-serve plans only (FOUNDING is never picked through
 * checkout — see assignFoundingPlanDev below and scripts/assignFoundingPlan.ts
 * for how that's assigned instead). Deliberately not gated by
 * assertMutationAllowed — a company with a lapsed subscription must still be
 * able to reach checkout to fix it.
 */
export async function createCheckoutSessionAction(plan: "STARTER" | "GROWTH"): Promise<CheckoutActionResult> {
  const session = await requireSession();
  if (!canManageCompany(session.role)) throw new ForbiddenError("Only the Owner can manage billing.");

  const provider = getActiveBillingProvider();
  if (!provider) return { ok: false, error: "Billing isn't connected in this environment yet — contact us to upgrade." };

  const [company, user, subscription] = await Promise.all([
    prisma.company.findFirstOrThrow({ where: { id: session.companyId } }),
    prisma.user.findFirstOrThrow({ where: { id: session.userId } }),
    prisma.subscription.findUnique({ where: { companyId: session.companyId } }),
  ]);

  const base = getAppBaseUrl();
  const result = await provider.createCheckoutSession({
    companyId: company.id,
    plan,
    customerEmail: user.email,
    existingStripeCustomerId: subscription?.billingCustomerId ?? null,
    successUrl: `${base}/settings/billing?checkout=success`,
    cancelUrl: `${base}/settings/billing?checkout=cancelled`,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, url: result.url };
}

export type PortalActionResult = { ok: true; url: string } | { ok: false; error: string };

/** Owner-only. Requires a real Stripe customer to already exist (i.e., at least one checkout has completed). */
export async function createPortalSessionAction(): Promise<PortalActionResult> {
  const session = await requireSession();
  if (!canManageCompany(session.role)) throw new ForbiddenError("Only the Owner can manage billing.");

  const provider = getActiveBillingProvider();
  if (!provider) return { ok: false, error: "Billing isn't connected in this environment yet." };

  const subscription = await prisma.subscription.findUnique({ where: { companyId: session.companyId } });
  if (!subscription?.billingCustomerId) {
    return { ok: false, error: "No billing account yet — upgrade to a paid plan first." };
  }

  const result = await provider.createPortalSession({
    stripeCustomerId: subscription.billingCustomerId,
    returnUrl: `${getAppBaseUrl()}/settings/billing`,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, url: result.url };
}

export type AssignFoundingResult = { error?: string };

/**
 * Local/staging development convenience ONLY — hard-gated on NODE_ENV, same
 * discipline as resetDemoData() in dev.ts, so it can never run in a deployed
 * environment even if a bad actor obtained Owner access there. This is NOT
 * the mechanism for assigning a real pilot customer's FOUNDING plan in
 * production — that's scripts/assignFoundingPlan.ts, an operator-run CLI
 * script with no web-reachable code path at all. This action exists purely
 * so the FOUNDING state can be exercised/tested locally without either
 * editing database rows by hand or running a separate script every time.
 */
export async function assignFoundingPlanDev(): Promise<AssignFoundingResult> {
  if (process.env.NODE_ENV === "production") {
    throw new ForbiddenError("Founding-plan self-assignment is never available in production.");
  }

  const session = await requireSession();
  if (!canManageCompany(session.role)) throw new ForbiddenError("Only the Owner can manage billing.");

  await prisma.subscription.upsert({
    where: { companyId: session.companyId },
    update: { plan: "FOUNDING", status: "ACTIVE", currentPeriodStart: new Date(), cancelAtPeriodEnd: false, cancelledAt: null },
    create: { companyId: session.companyId, plan: "FOUNDING", status: "ACTIVE", currentPeriodStart: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      companyId: session.companyId,
      userId: session.userId,
      action: "PLAN_CHANGED",
      entityType: "Subscription",
      entityId: session.companyId,
      metadata: JSON.stringify({ to: "FOUNDING", via: "dev_tool" }),
    },
  });

  revalidatePath("/settings/billing");
  revalidatePath("/");
  return {};
}
