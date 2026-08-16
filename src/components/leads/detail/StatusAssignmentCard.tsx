"use client";

import { useState, useTransition } from "react";
import type { LeadDetail } from "@/server/data/leads";
import type { LeadStatus } from "@/generated/prisma/client";
import { Card, Field, PrimaryButton, ErrorText, selectClass } from "@/components/ui";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { labelize } from "@/lib/format";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { changeStatus, assignSalesperson } from "@/server/actions/leads";

export function StatusAssignmentCard({
  lead,
  users,
  actingUserId,
}: {
  lead: LeadDetail;
  users: { id: string; name: string; role: string }[];
  actingUserId: string | null;
}) {
  const [status, setStatus] = useState<string>(lead.status);
  const [ownerId, setOwnerId] = useState<string>(lead.ownerId ?? "");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [statusPending, startStatusTransition] = useTransition();
  const [ownerPending, startOwnerTransition] = useTransition();

  // Keep local selections in sync when the lead is updated elsewhere (e.g. "Mark
  // contacted"), since this component doesn't remount on revalidation. Adjusting
  // state during render (rather than in an effect) avoids an extra render pass.
  const [syncedStatus, setSyncedStatus] = useState(lead.status);
  const [syncedOwnerId, setSyncedOwnerId] = useState(lead.ownerId);
  if (syncedStatus !== lead.status) {
    setSyncedStatus(lead.status);
    setStatus(lead.status);
  }
  if (syncedOwnerId !== lead.ownerId) {
    setSyncedOwnerId(lead.ownerId);
    setOwnerId(lead.ownerId ?? "");
  }

  const isClosed = !lead.risk.isActive;

  function handleStatusUpdate() {
    setStatusError(null);
    startStatusTransition(async () => {
      try {
        await changeStatus(lead.id, status as Exclude<LeadStatus, "WON" | "LOST">, actingUserId);
      } catch (e) {
        setStatusError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleAssign() {
    setOwnerError(null);
    startOwnerTransition(async () => {
      try {
        await assignSalesperson(lead.id, ownerId || null, actingUserId);
      } catch (e) {
        setOwnerError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Card title="Status & Assignment">
      <div className="mb-4 flex items-center gap-2">
        <StatusBadge status={lead.status} />
        <PriorityBadge priority={lead.priority} />
      </div>

      {!isClosed && (
        <div className="mb-4 flex flex-col gap-2">
          <Field label="Change status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              {ACTIVE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </select>
          </Field>
          <ErrorText>{statusError}</ErrorText>
          <PrimaryButton onClick={handleStatusUpdate} disabled={statusPending || status === lead.status}>
            {statusPending ? "Updating…" : "Update status"}
          </PrimaryButton>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
        <Field label="Assigned salesperson">
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={selectClass}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({labelize(u.role)})
              </option>
            ))}
          </select>
        </Field>
        <ErrorText>{ownerError}</ErrorText>
        <PrimaryButton onClick={handleAssign} disabled={ownerPending || ownerId === (lead.ownerId ?? "")}>
          {ownerPending ? "Assigning…" : "Assign"}
        </PrimaryButton>
      </div>
    </Card>
  );
}
