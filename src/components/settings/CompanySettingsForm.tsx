"use client";

import { useState, useTransition } from "react";
import { updateCompanySettings, type CompanySettingsInput } from "@/server/actions/company";
import { Field, PrimaryButton, ErrorText, inputClass, selectClass } from "@/components/ui";
import { formatSource } from "@/lib/format";

const LEAD_SOURCE_OPTIONS = ["INDIAMART", "WEBSITE", "WHATSAPP", "JUSTDIAL", "EXPORTERS_INDIA", "TRADEINDIA", "EMAIL", "PHONE", "REFERRAL"] as const;

// A real dropdown of every IANA zone the runtime knows about, rather than a
// free-text field — this value drives Dashboard/Lead risk/Tasks/My Day/Team
// day-boundary calculations everywhere else in the app, so an invalid typo
// here would silently break all of them. Falls back to a short curated list
// only if the browser doesn't support Intl.supportedValuesOf (very old browsers).
function getTimezoneOptions(current: string): string[] {
  try {
    const zones = Intl.supportedValuesOf("timeZone");
    return zones.includes(current) ? zones : [current, ...zones];
  } catch {
    const fallback = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "UTC"];
    return fallback.includes(current) ? fallback : [current, ...fallback];
  }
}

export function CompanySettingsForm({ initial }: { initial: CompanySettingsInput }) {
  const [form, setForm] = useState(initial);
  const [newReason, setNewReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [timezoneOptions] = useState(() => getTimezoneOptions(initial.timezone));

  function set<K extends keyof CompanySettingsInput>(key: K, value: CompanySettingsInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function toggleSource(source: string) {
    set(
      "activeLeadSources",
      (form.activeLeadSources.includes(source as never)
        ? form.activeLeadSources.filter((s) => s !== source)
        : [...form.activeLeadSources, source]) as CompanySettingsInput["activeLeadSources"]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateCompanySettings(form);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Company profile</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company name">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} required />
          </Field>
          <Field label="Industry">
            <input value={form.industry} onChange={(e) => set("industry", e.target.value)} className={inputClass} />
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
          <Field label="Timezone" helper="Used for every due-today/overdue calculation across the app.">
            <select value={form.timezone} onChange={(e) => set("timezone", e.target.value)} className={selectClass}>
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Currency">
            <input value={form.currency} onChange={(e) => set("currency", e.target.value)} className={inputClass} />
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Sales workflow</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`High-value opportunity threshold (${form.currency || "INR"})`}>
            <input
              type="number"
              min={0}
              value={form.highValueThreshold}
              onChange={(e) => set("highValueThreshold", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Default lead priority">
            <select value={form.defaultPriority} onChange={(e) => set("defaultPriority", e.target.value as CompanySettingsInput["defaultPriority"])} className={selectClass}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </Field>
          <Field label="Default follow-up window (days)">
            <input
              type="number"
              min={1}
              value={form.defaultFollowUpDays}
              onChange={(e) => set("defaultFollowUpDays", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Quotation overdue threshold (days)">
            <input
              type="number"
              min={1}
              value={form.staleQuotationDays}
              onChange={(e) => set("staleQuotationDays", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-4">
          <span className="text-xs font-medium text-slate-500">Common lost reasons</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {form.lostReasonPresets.map((reason) => (
              <span key={reason} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                {reason}
                <button
                  type="button"
                  onClick={() => set("lostReasonPresets", form.lostReasonPresets.filter((x) => x !== reason))}
                  className="text-slate-400 transition-colors duration-(--dur-micro) hover:text-slate-600"
                  aria-label={`Remove ${reason}`}
                >
                  ×
                </button>
              </span>
            ))}
            {form.lostReasonPresets.length === 0 && <span className="text-xs text-slate-400">None set.</span>}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Add a reason"
              className={inputClass}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = newReason.trim();
                  if (v && !form.lostReasonPresets.includes(v)) set("lostReasonPresets", [...form.lostReasonPresets, v]);
                  setNewReason("");
                }
              }}
            />
          </div>
        </div>

        <div className="mt-4">
          <span className="text-xs font-medium text-slate-500">Lead sources you use</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LEAD_SOURCE_OPTIONS.map((source) => {
              const checked = form.activeLeadSources.includes(source as never);
              return (
                <label
                  key={source}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors duration-(--dur-micro) ${checked ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleSource(source)} />
                  {formatSource(source)}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      {saved && !error && <p className="text-xs font-medium text-emerald-600">Saved.</p>}

      <div>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </PrimaryButton>
      </div>
    </form>
  );
}
