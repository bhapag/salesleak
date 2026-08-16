"use client";

import { useState, useTransition } from "react";
import { extractEnquiryFromText } from "@/server/actions/ai";
import type { ExtractedEnquiry } from "@/server/ai/features/enquiryExtraction";
import { SecondaryButton, ErrorText, inputClass } from "@/components/ui";
import { AiBadge } from "@/components/ai/AiBadge";

export function AiEnquiryExtractor({ onExtracted }: { onExtracted: (data: ExtractedEnquiry) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ mocked: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function extract() {
    setError(null);
    setApplied(null);
    startTransition(async () => {
      const result = await extractEnquiryFromText(text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onExtracted(result.data);
      setApplied({ mocked: result.mocked });
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs font-medium text-violet-700 hover:text-violet-900">
        <span aria-hidden>✦</span> Paste a messy enquiry and extract fields with AI
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-violet-800">Paste the raw enquiry text — AI fills in what it can, you review before saving.</p>
        <AiBadge />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder='e.g. "hi sir ravi this side need 5 ton gp material monthly gurgaon send best rate urgently"'
        className={`${inputClass} mt-2 resize-none`}
      />
      <ErrorText>{error}</ErrorText>
      {applied && (
        <p className="mt-1 text-xs font-medium text-emerald-700">
          Fields below have been pre-filled — please review before saving.{applied.mocked ? " (development mode)" : ""}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <SecondaryButton onClick={extract} disabled={pending || !text.trim()} className="!py-1 !text-xs">
          {pending ? "Extracting…" : "Extract with AI"}
        </SecondaryButton>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setText("");
            setError(null);
            setApplied(null);
          }}
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
