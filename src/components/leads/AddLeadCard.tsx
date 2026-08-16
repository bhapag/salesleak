"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createManualLead, type ManualLeadFormInput } from "@/server/actions/ingestion";
import { Card, Field, PrimaryButton, SecondaryButton, ErrorText, inputClass, selectClass } from "@/components/ui";
import { LEAD_SOURCES, LEAD_PRIORITIES } from "@/lib/constants";
import { formatSource, labelize } from "@/lib/format";
import { AiEnquiryExtractor } from "@/components/ai/AiEnquiryExtractor";
import type { ExtractedEnquiry } from "@/server/ai/features/enquiryExtraction";

const URGENCY_TO_PRIORITY: Record<string, ManualLeadFormInput["priority"]> = {
  urgent: "URGENT",
  high: "HIGH",
  normal: "MEDIUM",
  low: "LOW",
};

function buildEmptyForm(defaultPriority: ManualLeadFormInput["priority"], defaultFollowUpDays: number): ManualLeadFormInput {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + defaultFollowUpDays);
  return {
    customerName: "",
    companyName: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    source: "MANUAL",
    product: "",
    quantity: "",
    requirement: "",
    estimatedValue: "",
    assignToUserId: "",
    priority: defaultPriority,
    nextAction: "",
    nextActionDeadline: deadline.toISOString().slice(0, 10),
  };
}

export function AddLeadCard({
  users,
  defaultPriority = "MEDIUM",
  defaultFollowUpDays = 3,
}: {
  users: { id: string; name: string }[];
  defaultPriority?: ManualLeadFormInput["priority"];
  defaultFollowUpDays?: number;
}) {
  const EMPTY_FORM = buildEmptyForm(defaultPriority, defaultFollowUpDays);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ManualLeadFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof ManualLeadFormInput>(key: K, value: ManualLeadFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDuplicateWarning(null);
  }

  // AI extraction only ever pre-fills — every field it touches remains a
  // normal editable input the user reviews before "Add Lead" actually saves
  // anything. Never overwrites a field the user already typed something into.
  function applyExtraction(extracted: ExtractedEnquiry) {
    setForm((f) => ({
      ...f,
      customerName: f.customerName || extracted.customerName || "",
      companyName: f.companyName || extracted.companyName || "",
      phone: f.phone || extracted.phone || "",
      email: f.email || extracted.email || "",
      city: f.city || extracted.location || "",
      product: f.product || extracted.product || "",
      quantity: f.quantity || extracted.quantity || "",
      requirement: f.requirement || extracted.requirement || "",
      priority: extracted.urgency ? URGENCY_TO_PRIORITY[extracted.urgency] : f.priority,
    }));
  }

  function submit(forceCreate: boolean) {
    setErrors([]);
    startTransition(async () => {
      const result = await createManualLead(form, forceCreate);
      if (result.status === "created") {
        setForm(EMPTY_FORM);
        setDuplicateWarning(null);
        setOpen(false);
        return;
      }
      if (result.status === "duplicate") {
        setDuplicateWarning(result.reason);
        return;
      }
      setErrors(result.errors);
    });
  }

  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <PrimaryButton onClick={() => setOpen(true)}>+ Add Lead</PrimaryButton>
        <Link href="/leads/import">
          <SecondaryButton>Import CSV</SecondaryButton>
        </Link>
      </div>
    );
  }

  return (
    <Card title="Add Lead" description="Log a new enquiry — customer, what they need, and what happens next.">
      <div className="flex flex-col gap-4">
        <AiEnquiryExtractor onExtracted={applyExtraction} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Customer / Contact Name *">
            <input value={form.customerName} onChange={(e) => set("customerName", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Company Name">
            <input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />
          </Field>
          <Field label="City">
            <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputClass} />
          </Field>
          <Field label="State">
            <input value={form.state} onChange={(e) => set("state", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Source">
            <select value={form.source} onChange={(e) => set("source", e.target.value as ManualLeadFormInput["source"])} className={selectClass}>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {formatSource(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Product">
            <input value={form.product} onChange={(e) => set("product", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Quantity">
            <input value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Estimated Value (₹)">
            <input
              type="number"
              min="0"
              value={form.estimatedValue}
              onChange={(e) => set("estimatedValue", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Salesperson">
            <select value={form.assignToUserId} onChange={(e) => set("assignToUserId", e.target.value)} className={selectClass}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={(e) => set("priority", e.target.value as ManualLeadFormInput["priority"])} className={selectClass}>
              {LEAD_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {labelize(p)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Requirement">
          <textarea
            value={form.requirement}
            onChange={(e) => set("requirement", e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <Field label="Next Action *">
            <input value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Deadline *">
            <input
              type="date"
              value={form.nextActionDeadline}
              onChange={(e) => set("nextActionDeadline", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        {duplicateWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-sm font-medium text-amber-800">Possible Duplicate</p>
            <p className="mt-0.5 text-xs text-amber-700">{duplicateWarning}</p>
            <div className="mt-2 flex gap-2">
              <SecondaryButton onClick={() => submit(true)} disabled={pending} className="!py-1.5 !text-xs">
                Create Anyway
              </SecondaryButton>
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="text-xs font-medium text-amber-700 hover:text-amber-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {errors.map((e) => (
          <ErrorText key={e}>{e}</ErrorText>
        ))}

        <div className="flex gap-2">
          <PrimaryButton onClick={() => submit(false)} disabled={pending}>
            {pending ? "Adding…" : "Add Lead"}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => {
              setOpen(false);
              setForm(EMPTY_FORM);
              setErrors([]);
              setDuplicateWarning(null);
            }}
            disabled={pending}
          >
            Cancel
          </SecondaryButton>
        </div>
      </div>
    </Card>
  );
}
