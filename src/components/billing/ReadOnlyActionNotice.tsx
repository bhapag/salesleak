import Link from "next/link";
import { Card } from "@/components/ui";

/**
 * Shown in place of a "create" control while the workspace is read-only.
 *
 * The app-wide SubscriptionBanner already says the workspace is read-only,
 * but every creation control stayed fully enabled underneath it — so the
 * honest way to find out was to fill in an entire lead or quotation form and
 * submit it. Worse for quotations: createQuotation throws, and Next.js
 * redacts thrown Server Action messages in production, so that path ended in
 * a generic error rather than an explanation.
 *
 * This is presentation only. Server-side enforcement is unchanged and remains
 * the actual boundary — assertMutationAllowed still runs on every mutating
 * action, so hiding a button grants nothing and skipping this component
 * blocks nothing.
 *
 * Reading and exporting stay available everywhere, deliberately: a lapsed
 * subscription must never hold a company's own data hostage.
 */
export function ReadOnlyActionNotice({ action, isOwner }: { action: string; isOwner: boolean }) {
  return (
    <Card>
      <p className="text-sm text-slate-700">
        <span className="font-medium">{action} is unavailable</span> while this workspace is read-only. Everything already here stays
        visible, and you can still export it.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {isOwner ? (
          <>
            Reactivate the subscription to start adding again —{" "}
            <Link href="/settings/billing" className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
              go to Billing
            </Link>
            .
          </>
        ) : (
          "Ask your Owner to reactivate the subscription to start adding again."
        )}
      </p>
    </Card>
  );
}
