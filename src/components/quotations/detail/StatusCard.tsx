"use client";

import { useState, useTransition } from "react";
import type { QuotationDetail } from "@/server/data/quotations";
import type { QuotationStatus } from "@/generated/prisma/client";
import { Card, Field, PrimaryButton, ErrorText, selectClass } from "@/components/ui";
import { QuotationStatusBadge } from "@/components/badges";
import { QUOTATION_ACTIVE_STATUSES } from "@/lib/constants";
import { QUOTATION_STATUS_LABEL } from "@/lib/quotationRisk";
import { changeQuotationStatus } from "@/server/actions/quotations";

export function StatusCard({ quotation, actingUserId }: { quotation: QuotationDetail; actingUserId: string | null }) {
  const [status, setStatus] = useState<string>(quotation.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [syncedStatus, setSyncedStatus] = useState(quotation.status);
  if (syncedStatus !== quotation.status) {
    setSyncedStatus(quotation.status);
    setStatus(quotation.status);
  }

  const isClosed = !quotation.risk.isOpen;

  function handleUpdate() {
    setError(null);
    startTransition(async () => {
      try {
        await changeQuotationStatus(quotation.id, status as Exclude<QuotationStatus, "ACCEPTED" | "REJECTED">, actingUserId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Card title="Status">
      <div className="mb-4">
        <QuotationStatusBadge status={quotation.risk.displayStatus} />
      </div>

      {!isClosed && (
        <div className="flex flex-col gap-2">
          <Field label="Change status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              {QUOTATION_ACTIVE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {QUOTATION_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <ErrorText>{error}</ErrorText>
          <PrimaryButton onClick={handleUpdate} disabled={pending || status === quotation.status}>
            {pending ? "Updating…" : "Update status"}
          </PrimaryButton>
        </div>
      )}
    </Card>
  );
}
