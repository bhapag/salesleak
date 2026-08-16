"use client";

import { useState } from "react";
import { Field, PrimaryButton, ErrorText, inputClass } from "@/components/ui";

const EMPTY = {
  name: "",
  company: "",
  phone: "",
  email: "",
  city: "",
  product: "",
  requirement: "",
  quantity: "",
  estimatedValue: "",
};

export function WebsiteFormDemo({ token }: { token: string }) {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/webhooks/website/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sourcePage: typeof window !== "undefined" ? window.location.pathname : null }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult("success");
        setForm(EMPTY);
      } else {
        setResult("error");
        setError(body.error ?? "Something went wrong submitting this form.");
      }
    } catch {
      setResult("error");
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result === "success") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-sm font-semibold text-emerald-800">Thanks — your enquiry has been received.</p>
        <p className="mt-1 text-xs text-emerald-700">Someone from our team will get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name *">
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Company">
          <input value={form.company} onChange={(e) => set("company", e.target.value)} className={inputClass} />
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
        <Field label="Product">
          <input value={form.product} onChange={(e) => set("product", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Quantity">
          <input value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Estimated Value (₹)">
          <input type="number" min="0" value={form.estimatedValue} onChange={(e) => set("estimatedValue", e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="What do you need?">
        <textarea rows={3} value={form.requirement} onChange={(e) => set("requirement", e.target.value)} className={`${inputClass} resize-none`} />
      </Field>

      {result === "error" && <ErrorText>{error}</ErrorText>}

      <PrimaryButton type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Send Enquiry"}
      </PrimaryButton>
    </form>
  );
}
