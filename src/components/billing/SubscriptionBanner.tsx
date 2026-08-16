import Link from "next/link";
import type { SubscriptionState } from "@/server/billing/entitlements";

/**
 * App-wide, shown on every page (rendered once in the (app) layout) rather
 * than only on the dashboard — the whole point is that nobody should be
 * surprised by a blocked action later. Server Component: purely
 * informational, no interactivity beyond a link, so no client JS needed.
 */
export function SubscriptionBanner({ state, isOwner }: { state: SubscriptionState; isOwner: boolean }) {
  if (state.isReadOnly) {
    return (
      <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 sm:px-8">
        <p className="text-sm text-red-800">
          <span className="font-medium">This workspace is read-only</span> — its subscription has{" "}
          {state.effectiveStatus === "CANCELLED" ? "been cancelled" : "expired"}. Your data is safe and you can still view and export it.
          {isOwner ? (
            <>
              {" "}
              <Link href="/settings/billing" className="font-medium underline hover:text-red-900">
                Reactivate in Billing →
              </Link>
            </>
          ) : (
            " Ask your Owner to reactivate the subscription."
          )}
        </p>
      </div>
    );
  }

  if (state.status === "PAST_DUE") {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 sm:px-8">
        <p className="text-sm text-amber-800">
          <span className="font-medium">There&apos;s a payment issue</span> with this workspace&apos;s subscription.
          {isOwner ? (
            <>
              {" "}
              <Link href="/settings/billing" className="font-medium underline hover:text-amber-900">
                Fix billing →
              </Link>
            </>
          ) : (
            " Ask your Owner to check Billing."
          )}
        </p>
      </div>
    );
  }

  if (state.status === "TRIAL" && state.trialDaysRemaining !== null) {
    const urgent = state.trialDaysRemaining <= 3;
    return (
      <div className={`border-b px-4 py-2.5 sm:px-8 ${urgent ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
        <p className={`text-sm ${urgent ? "text-amber-800" : "text-slate-600"}`}>
          {state.trialDaysRemaining === 0 ? "Your trial ends today." : `${state.trialDaysRemaining} day${state.trialDaysRemaining === 1 ? "" : "s"} left in your trial.`}
          {isOwner && (
            <>
              {" "}
              <Link href="/settings/billing" className="font-medium underline hover:opacity-80">
                View plans →
              </Link>
            </>
          )}
        </p>
      </div>
    );
  }

  return null;
}
