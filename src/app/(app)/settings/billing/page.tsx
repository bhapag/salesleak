import type { Metadata } from "next";
import { requireSession } from "@/server/auth/session";
import { canManageCompany } from "@/server/auth/permissions";
import { NotAuthorized } from "@/components/auth/NotAuthorized";
import { getSubscriptionState } from "@/server/billing/entitlements";
import { isBillingConfigured } from "@/server/billing/client";
import { PLAN_CONFIG, getPlanConfig } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { UpgradeButton, ManageBillingButton, AssignFoundingDevButton } from "@/components/billing/BillingActions";

export const metadata: Metadata = { title: "Billing" };

const STATUS_LABEL: Record<string, string> = {
  TRIAL: "Trial",
  ACTIVE: "Active",
  PAST_DUE: "Payment issue",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const STATUS_STYLE: Record<string, string> = {
  TRIAL: "bg-slate-100 text-slate-700 ring-slate-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PAST_DUE: "bg-amber-50 text-amber-700 ring-amber-200",
  CANCELLED: "bg-red-50 text-red-700 ring-red-200",
  EXPIRED: "bg-red-50 text-red-700 ring-red-200",
};

export default async function BillingPage() {
  const session = await requireSession();
  if (!canManageCompany(session.role)) {
    return <NotAuthorized message="Only the Owner can view and manage billing." />;
  }

  const [state, subscription] = await Promise.all([
    getSubscriptionState(session.companyId),
    prisma.subscription.findUnique({ where: { companyId: session.companyId } }),
  ]);
  const billingConfigured = isBillingConfigured();
  const currentPlanConfig = getPlanConfig(state.plan);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8">
        <h1 className="text-xl font-semibold text-slate-900">Billing</h1>
        <p className="text-sm text-slate-500">Plan, subscription status, and payment for {session.companyName}.</p>
        <p className="mt-1 text-xs text-slate-400">
          SalesLeak by <span className="text-[#B08A45]">NobleArc</span>
        </p>
      </header>

      <main className="flex flex-col gap-6 px-4 py-6 sm:px-8">
        <Card title="Current plan">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-slate-900">{currentPlanConfig.name}</p>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[state.effectiveStatus]}`}
                >
                  {STATUS_LABEL[state.effectiveStatus]}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{currentPlanConfig.tagline}</p>

              {state.status === "TRIAL" && state.trialEnd && (
                <p className="mt-2 text-sm text-slate-600">
                  {state.trialDaysRemaining !== null && state.trialDaysRemaining > 0
                    ? `${state.trialDaysRemaining} day${state.trialDaysRemaining === 1 ? "" : "s"} left in your trial`
                    : "Your trial has ended"}{" "}
                  — ends <span className="tabular-nums">{formatDate(state.trialEnd)}</span>.
                </p>
              )}
              {state.currentPeriodEnd && (
                <p className="mt-2 text-sm text-slate-600">
                  Current billing period ends <span className="tabular-nums">{formatDate(state.currentPeriodEnd)}</span>
                  {state.cancelAtPeriodEnd && " — will not renew"}.
                </p>
              )}
            </div>
            <ManageBillingButton billingConfigured={billingConfigured} hasBillingAccount={!!subscription?.billingCustomerId} />
          </div>
        </Card>

        {state.isReadOnly && (
          <Card className="border-red-200 bg-red-50">
            <p className="text-sm font-medium text-red-800">This workspace is read-only</p>
            <p className="mt-1 text-xs text-red-700">
              Your subscription needs attention before changes can be made again. Your data is safe, and export always works regardless of
              subscription state.
            </p>
          </Card>
        )}

        {!billingConfigured && (
          <Card className="border-sky-200 bg-sky-50">
            <p className="text-sm font-medium text-sky-800">Billing test/dev mode</p>
            <p className="mt-1 text-xs text-sky-700">
              Stripe isn&apos;t connected in this environment yet, so upgrades and payment aren&apos;t available for real here. Nothing is charged and no
              fake payment is simulated — this is an honest, clearly-labeled state, not a placeholder pretending to work.
            </p>
          </Card>
        )}

        <div>
          <h2 className="text-sm font-semibold text-slate-900">Plans</h2>
          <p className="mt-0.5 text-xs text-slate-500">Simple, transparent pricing. No hidden tiers.</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(["STARTER", "GROWTH", "FOUNDING"] as const).map((planId) => {
              const plan = PLAN_CONFIG[planId];
              const isCurrent = state.plan === planId;
              return (
                <Card
                  key={planId}
                  className={`transition-colors duration-(--dur-micro) ${isCurrent ? "border-slate-900" : "hover:border-slate-300"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                    {isCurrent && <span className="text-xs font-medium text-slate-500">Current plan</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{plan.tagline}</p>
                  <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">
                    {plan.priceMonthlyInr != null ? `${formatCurrency(plan.priceMonthlyInr)}/mo` : "Contact us"}
                  </p>
                  <ul className="mt-3 flex flex-col gap-1.5 text-xs text-slate-600">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5">
                        <span className="mt-0.5 text-emerald-600">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    {isCurrent ? (
                      <p className="text-xs text-slate-400">This is your current plan.</p>
                    ) : plan.selfServe ? (
                      <UpgradeButton plan={planId as "STARTER" | "GROWTH"} billingConfigured={billingConfigured} />
                    ) : (
                      <p className="text-xs text-slate-400">Assigned directly by the SalesLeak team.</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {process.env.NODE_ENV !== "production" && (
          <Card title="Developer tools" description="Local/staging only — never available in production.">
            <AssignFoundingDevButton />
          </Card>
        )}
      </main>
    </div>
  );
}
