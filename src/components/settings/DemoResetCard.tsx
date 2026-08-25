"use client";

import { useState, useTransition } from "react";
import { resetDemoData } from "@/server/actions/dev";
import { Card, DangerButton, ErrorText, inputClass } from "@/components/ui";

const CONFIRMATION_PHRASE = "RESET DEMO DATA";

export function DemoResetCard() {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReset() {
    setError(null);
    startTransition(async () => {
      const result = await resetDemoData(confirmation);
      if (result?.error) setError(result.error);
      // On success the action redirects to /login itself — nothing to do here.
    });
  }

  return (
    <Card
      title="Reset demo data"
      description="Local development only. Wipes ALL companies and reseeds the fictional demo dataset from scratch. This signs everyone out."
      className="border-red-200"
    >
      <p className="mb-3 text-xs text-red-700">This never runs in production and never touches real customer data.</p>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500">
          Type <span className="font-mono font-semibold">{CONFIRMATION_PHRASE}</span> to confirm
        </span>
        <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={inputClass} placeholder={CONFIRMATION_PHRASE} />
      </label>
      <ErrorText>{error}</ErrorText>
      <div className="mt-3">
        <DangerButton onClick={handleReset} loading={pending} disabled={confirmation.trim() !== CONFIRMATION_PHRASE}>
          {pending ? "Resetting…" : "Reset demo data"}
        </DangerButton>
      </div>
    </Card>
  );
}
