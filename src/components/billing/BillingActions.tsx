"use client";

import { useState, useTransition } from "react";
import { createCheckoutSessionAction, createPortalSessionAction, assignFoundingPlanDev } from "@/server/actions/billing";
import { PrimaryButton, SecondaryButton, ErrorText } from "@/components/ui";

export function UpgradeButton({ plan, billingConfigured }: { plan: "STARTER" | "GROWTH"; billingConfigured: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUpgrade() {
    setError(null);
    startTransition(async () => {
      const result = await createCheckoutSessionAction(plan);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  if (!billingConfigured) {
    return (
      <div className="flex flex-col gap-1">
        <SecondaryButton disabled>Upgrade (billing not connected yet)</SecondaryButton>
        <p className="text-[11px] text-slate-400">Contact us to upgrade while billing is being set up in this environment.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <PrimaryButton onClick={handleUpgrade} disabled={pending}>
        {pending ? "Redirecting…" : `Upgrade to ${plan === "STARTER" ? "Starter" : "Growth"}`}
      </PrimaryButton>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export function ManageBillingButton({ billingConfigured, hasBillingAccount }: { billingConfigured: boolean; hasBillingAccount: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleManage() {
    setError(null);
    startTransition(async () => {
      const result = await createPortalSessionAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  if (!billingConfigured || !hasBillingAccount) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <SecondaryButton onClick={handleManage} disabled={pending}>
        {pending ? "Opening…" : "Manage billing"}
      </SecondaryButton>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

/**
 * Local/staging testing convenience only — the server action itself is
 * hard-gated to NODE_ENV !== "production", so this component simply never
 * renders anything meaningful in a real deployment even if somehow reached.
 * The real, production-safe way to assign a founding customer's plan is
 * scripts/assignFoundingPlan.ts, run by the operator directly — not this.
 */
export function AssignFoundingDevButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleAssign() {
    setError(null);
    startTransition(async () => {
      const result = await assignFoundingPlanDev();
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <SecondaryButton onClick={handleAssign} disabled={pending} className="!border-dashed">
        {pending ? "Assigning…" : done ? "Assigned — Founding (dev)" : "Assign Founding plan (dev only)"}
      </SecondaryButton>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
