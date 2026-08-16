"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { QuotationDetail } from "@/server/data/quotations";
import { Card, PrimaryButton, ErrorText, inputClass } from "@/components/ui";
import { formatDateTime, labelize } from "@/lib/format";
import { addQuotationNote } from "@/server/actions/quotations";

const typeStyle: Record<string, string> = {
  CALL: "bg-blue-500",
  EMAIL: "bg-indigo-500",
  WHATSAPP: "bg-emerald-500",
  MEETING: "bg-purple-500",
  NOTE: "bg-slate-400",
  STATUS_CHANGE: "bg-amber-500",
};

export function ActivityCard({ quotation, actingUserId }: { quotation: QuotationDetail; actingUserId: string | null }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAddNote() {
    setError(null);
    startTransition(async () => {
      try {
        await addQuotationNote(quotation.id, note, actingUserId);
        setNote("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Card
      title="Activity"
      description={
        <>
          Quotation actions post to the{" "}
          <Link href={`/leads/${quotation.leadId}`} className="underline">
            linked lead&apos;s
          </Link>{" "}
          timeline
        </>
      }
    >
      <div className="mb-4 flex flex-col gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note about this quotation..."
          rows={2}
          className={`${inputClass} resize-none`}
        />
        <ErrorText>{error}</ErrorText>
        <div>
          <PrimaryButton onClick={handleAddNote} disabled={pending || !note.trim()}>
            {pending ? "Adding…" : "Add note"}
          </PrimaryButton>
        </div>
      </div>

      {quotation.lead.activities.length === 0 ? (
        <p className="text-sm text-slate-500">No activity logged yet.</p>
      ) : (
        <ul className="flex flex-col gap-4 border-t border-slate-100 pt-4">
          {quotation.lead.activities.map((activity) => (
            <li key={activity.id} className="flex gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${typeStyle[activity.type] ?? "bg-slate-400"}`} />
              <div className="min-w-0">
                <p className="text-sm text-slate-800">{activity.notes}</p>
                <p className="text-xs text-slate-400">
                  {labelize(activity.type)} · {activity.user?.name ?? "System"} · {formatDateTime(activity.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
