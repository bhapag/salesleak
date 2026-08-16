"use client";

import { useState, useTransition } from "react";
import type { FailedIngestionEntry } from "@/server/data/ingestion";
import { retryFailedIngestion, dismissFailedIngestion, type FailedIngestionCorrections } from "@/server/actions/integrations";
import { SourceBadge } from "@/components/badges";
import { PrimaryButton, SecondaryButton, Field, inputClass, ErrorText } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

type NormalizedPreview = { customerName?: string; phone?: string; email?: string; product?: string; requirement?: string; estimatedValue?: number };

function tryParseNormalized(json: string | null): NormalizedPreview | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as NormalizedPreview;
  } catch {
    return null;
  }
}

export function FailedIngestionQueue({ entries }: { entries: FailedIngestionEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-white shadow-sm">
      <div className="border-b border-amber-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Failed Ingestion Queue</h2>
        <p className="text-xs text-slate-500">
          External data that couldn&apos;t become a lead — nothing here was silently discarded. Correct and retry, or dismiss.
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {entries.map((entry) => (
          <FailedIngestionRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

function FailedIngestionRow({ entry }: { entry: FailedIngestionEntry }) {
  const [expanded, setExpanded] = useState(false);
  const preview = tryParseNormalized(entry.normalizedPayload);
  const [form, setForm] = useState({
    customerName: preview?.customerName ?? "",
    phone: preview?.phone ?? "",
    email: preview?.email ?? "",
    product: preview?.product ?? "",
    requirement: preview?.requirement ?? "",
    estimatedValue: preview?.estimatedValue != null ? String(preview.estimatedValue) : "",
  });
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [resolved, setResolved] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleRetry() {
    setErrors([]);
    const corrections: FailedIngestionCorrections = { ...form };
    startTransition(async () => {
      const result = await retryFailedIngestion(entry.id, corrections);
      if (result.status === "created" || result.status === "duplicate") {
        setResolved(true);
        return;
      }
      setErrors(result.errors ?? ["Still couldn't create a lead from this data."]);
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      await dismissFailedIngestion(entry.id);
      setDismissed(true);
    });
  }

  if (dismissed || resolved) {
    return (
      <li className="px-5 py-3 text-sm text-slate-400">
        {resolved ? "Resolved — lead created." : "Dismissed."} <span className="text-xs">({entry.errorMessage})</span>
      </li>
    );
  }

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SourceBadge source={entry.provider} />
            <span className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</span>
            {entry.retryCount > 0 && <span className="text-xs text-slate-400">· retried {entry.retryCount}x</span>}
          </div>
          <p className="mt-1 text-sm font-medium text-red-700">{entry.errorMessage}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <SecondaryButton onClick={() => setExpanded((v) => !v)} className="!py-1.5 !text-xs">
            {expanded ? "Hide" : "Inspect & Retry"}
          </SecondaryButton>
          <button type="button" onClick={handleDismiss} disabled={pending} className="text-xs font-medium text-slate-400 hover:text-slate-700">
            Dismiss
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 rounded-lg bg-slate-50 p-3">
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer font-medium text-slate-600">Raw payload</summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-white p-2 text-[11px] text-slate-600 ring-1 ring-slate-200">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(entry.rawPayload), null, 2);
                } catch {
                  return entry.rawPayload;
                }
              })()}
            </pre>
          </details>

          <p className="text-xs font-medium text-slate-600">Correct and retry</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Customer / Company Name *">
              <input value={form.customerName} onChange={(e) => set("customerName", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Email">
              <input value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Product">
              <input value={form.product} onChange={(e) => set("product", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Estimated Value (₹)">
              <input type="number" min="0" value={form.estimatedValue} onChange={(e) => set("estimatedValue", e.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="Requirement">
            <textarea rows={2} value={form.requirement} onChange={(e) => set("requirement", e.target.value)} className={`${inputClass} resize-none`} />
          </Field>

          {errors.map((e) => (
            <ErrorText key={e}>{e}</ErrorText>
          ))}

          <div>
            <PrimaryButton onClick={handleRetry} disabled={pending || !form.customerName.trim()} className="!py-1.5 !text-xs">
              {pending ? "Retrying…" : "Retry Ingestion"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </li>
  );
}
