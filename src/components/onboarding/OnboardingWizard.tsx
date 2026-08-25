"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveOnboardingSettings,
  addTeamMemberDuringOnboarding,
  completeOnboarding,
  type OnboardingSettingsInput,
} from "@/server/actions/onboarding";
import { Card, Field, PrimaryButton, SecondaryButton, ErrorText, inputClass, selectClass } from "@/components/ui";
import { formatSource } from "@/lib/format";
import { OnboardingShell, StepHeader, SelectionCard } from "@/components/onboarding/OnboardingShell";

type CompanyInit = {
  name: string;
  industry: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  timezone: string;
  currency: string;
  highValueThreshold: number;
  defaultFollowUpDays: number;
  staleQuotationDays: number;
  defaultPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
};

const LEAD_SOURCE_OPTIONS = ["INDIAMART", "WEBSITE", "WHATSAPP", "JUSTDIAL", "EXPORTERS_INDIA", "TRADEINDIA", "EMAIL", "PHONE", "REFERRAL"] as const;

const DEFAULT_LOST_REASONS = ["Price too high", "Chose a competitor", "No budget", "Project cancelled", "No response"];

// Same real, zero-maintenance IANA zone list Company Settings uses — this
// value drives every day-boundary calculation in the app, so a brand-new
// Owner's very first interaction with SalesLeak shouldn't be a free-text
// field that can silently corrupt all of them with a typo.
function getTimezoneOptions(current: string): string[] {
  try {
    const zones = Intl.supportedValuesOf("timeZone");
    return zones.includes(current) ? zones : [current, ...zones];
  } catch {
    const fallback = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "UTC"];
    return fallback.includes(current) ? fallback : [current, ...fallback];
  }
}

type AddedMember = { name: string; email: string; role: "SALES_MANAGER" | "SALESPERSON"; password: string };
type LeadPlan = "csv" | "manual" | "skip" | null;

export function OnboardingWizard({ company }: { company: CompanyInit }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [details, setDetails] = useState({
    companyName: company.name,
    industry: company.industry,
    phone: company.phone,
    email: company.email,
    city: company.city,
    state: company.state,
    timezone: company.timezone,
    currency: company.currency,
  });

  const [members, setMembers] = useState<AddedMember[]>([]);
  const [timezoneOptions] = useState(() => getTimezoneOptions(company.timezone));

  const [highValueThreshold, setHighValueThreshold] = useState(String(company.highValueThreshold));
  const [defaultPriority, setDefaultPriority] = useState(company.defaultPriority);
  const [lostReasons, setLostReasons] = useState<string[]>(DEFAULT_LOST_REASONS);
  const [newReason, setNewReason] = useState("");

  const [leadSources, setLeadSources] = useState<Set<string>>(new Set());

  const [defaultFollowUpDays, setDefaultFollowUpDays] = useState(String(company.defaultFollowUpDays));
  const [staleQuotationDays, setStaleQuotationDays] = useState(String(company.staleQuotationDays));

  const [leadPlan, setLeadPlan] = useState<LeadPlan>(null);

  function goTo(n: number) {
    setError(null);
    setDirection(n >= step ? "forward" : "back");
    setStep(n);
  }

  function persistAndAdvance() {
    setError(null);
    const input: OnboardingSettingsInput = {
      ...details,
      highValueThreshold: Number(highValueThreshold) || 50000,
      defaultPriority,
      lostReasonPresets: lostReasons,
      activeLeadSources: Array.from(leadSources) as OnboardingSettingsInput["activeLeadSources"],
      defaultFollowUpDays: Number(defaultFollowUpDays) || 3,
      staleQuotationDays: Number(staleQuotationDays) || 10,
    };
    startTransition(async () => {
      const result = await saveOnboardingSettings(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDirection("forward");
      setStep(6);
    });
  }

  function finish(destination: string) {
    setError(null);
    startTransition(async () => {
      await completeOnboarding();
      router.push(destination);
      router.refresh();
    });
  }

  return (
    <OnboardingShell currentStep={step} companyName={details.companyName} direction={direction}>
      {step === 1 && (
        <div>
          <StepHeader eyebrow="Company setup" title="Tell us about your company" description="This appears on your quotations and across your workspace." />
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Company name" required>
                <input value={details.companyName} onChange={(e) => setDetails((d) => ({ ...d, companyName: e.target.value }))} className={inputClass} required />
              </Field>
              <Field label="Industry">
                <input value={details.industry} onChange={(e) => setDetails((d) => ({ ...d, industry: e.target.value }))} className={inputClass} placeholder="e.g. Industrial equipment" />
              </Field>
              <Field label="Phone">
                <input value={details.phone} onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="Email">
                <input type="email" value={details.email} onChange={(e) => setDetails((d) => ({ ...d, email: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="City">
                <input value={details.city} onChange={(e) => setDetails((d) => ({ ...d, city: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="State">
                <input value={details.state} onChange={(e) => setDetails((d) => ({ ...d, state: e.target.value }))} className={inputClass} />
              </Field>
              <Field label="Timezone" helper="Used for every due-today/overdue calculation across the app.">
                <select
                  value={details.timezone}
                  onChange={(e) => setDetails((d) => ({ ...d, timezone: e.target.value }))}
                  className={selectClass}
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Currency">
                <input value={details.currency} onChange={(e) => setDetails((d) => ({ ...d, currency: e.target.value }))} className={inputClass} />
              </Field>
            </div>
            <ErrorText>{error}</ErrorText>
            <div className="mt-5 flex justify-end">
              <PrimaryButton
                onClick={() => {
                  if (!details.companyName.trim()) {
                    setError("Company name is required.");
                    return;
                  }
                  goTo(2);
                }}
              >
                Continue
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}

      {step === 2 && (
        <TeamStep
          members={members}
          onAdd={(m) => setMembers((cur) => [...cur, m])}
          error={error}
          setError={setError}
          onBack={() => goTo(1)}
          onContinue={() => goTo(3)}
        />
      )}

      {step === 3 && (
        <div>
          <StepHeader eyebrow="Sales workflow" title="Set your workflow defaults" description="A few defaults that shape what gets flagged as needing attention. Change these anytime in Settings." />
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={`High-value opportunity threshold (${details.currency || "INR"})`}>
                <input type="number" min={0} value={highValueThreshold} onChange={(e) => setHighValueThreshold(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Default lead priority">
                <select value={defaultPriority} onChange={(e) => setDefaultPriority(e.target.value as typeof defaultPriority)} className={selectClass}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </Field>
            </div>

            <div className="mt-4">
              <span className="text-xs font-medium text-slate-500">Common lost reasons</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {lostReasons.map((reason) => (
                  <span key={reason} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                    {reason}
                    <button type="button" onClick={() => setLostReasons((r) => r.filter((x) => x !== reason))} className="text-slate-400 hover:text-slate-600" aria-label={`Remove ${reason}`}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <label htmlFor="onboarding-new-lost-reason" className="sr-only">
                  Add a lost reason
                </label>
                <input
                  id="onboarding-new-lost-reason"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Add a reason — press Enter to add"
                  className={inputClass}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = newReason.trim();
                      if (v && !lostReasons.includes(v)) setLostReasons((r) => [...r, v]);
                      setNewReason("");
                    }
                  }}
                />
                <SecondaryButton
                  type="button"
                  onClick={() => {
                    const v = newReason.trim();
                    if (v && !lostReasons.includes(v)) setLostReasons((r) => [...r, v]);
                    setNewReason("");
                  }}
                >
                  Add
                </SecondaryButton>
              </div>
            </div>

            <div className="mt-5 flex justify-between">
              <SecondaryButton onClick={() => goTo(2)}>Back</SecondaryButton>
              <PrimaryButton onClick={() => goTo(4)}>Continue</PrimaryButton>
            </div>
          </Card>
        </div>
      )}

      {step === 4 && (
        <div>
          <StepHeader eyebrow="Lead sources" title="Where do your leads come from?" description="Optional — helps tailor your workspace. Skip if you're not sure yet." />
          <Card>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LEAD_SOURCE_OPTIONS.map((source) => (
                <SelectionCard
                  key={source}
                  selected={leadSources.has(source)}
                  title={formatSource(source)}
                  onClick={() =>
                    setLeadSources((cur) => {
                      const next = new Set(cur);
                      if (next.has(source)) next.delete(source);
                      else next.add(source);
                      return next;
                    })
                  }
                />
              ))}
            </div>
            <div className="mt-5 flex justify-between">
              <SecondaryButton onClick={() => goTo(3)}>Back</SecondaryButton>
              <PrimaryButton onClick={() => goTo(5)}>Continue</PrimaryButton>
            </div>
          </Card>
        </div>
      )}

      {step === 5 && (
        <div>
          <StepHeader eyebrow="Follow-ups" title="Set your follow-up defaults" description="Used to flag leads and quotations that are going quiet." />
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Default follow-up window (days)">
                <input type="number" min={1} value={defaultFollowUpDays} onChange={(e) => setDefaultFollowUpDays(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Quotation overdue threshold (days)">
                <input type="number" min={1} value={staleQuotationDays} onChange={(e) => setStaleQuotationDays(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <ErrorText>{error}</ErrorText>
            <div className="mt-5 flex justify-between">
              <SecondaryButton onClick={() => goTo(4)}>Back</SecondaryButton>
              <PrimaryButton loading={pending} onClick={persistAndAdvance}>
                {pending ? "Saving…" : "Save & Continue"}
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}

      {step === 6 && (
        <div>
          <StepHeader eyebrow="Leads" title="Bring in your leads" description="You can always add more later." />
          <Card>
            <div className="flex flex-col gap-2">
              {(
                [
                  { id: "csv", title: "Import a CSV / Excel file", desc: "Bulk-import your existing enquiries." },
                  { id: "manual", title: "Add leads one by one", desc: "Start with your most active enquiries." },
                  { id: "skip", title: "Skip for now", desc: "I'll add leads later." },
                ] as const
              ).map((opt) => (
                <SelectionCard
                  key={opt.id}
                  selected={leadPlan === opt.id}
                  title={opt.title}
                  description={opt.desc}
                  onClick={() => {
                    setLeadPlan(opt.id);
                    goTo(7);
                  }}
                />
              ))}
            </div>
            <div className="mt-5 flex justify-start">
              <SecondaryButton onClick={() => goTo(5)}>Back</SecondaryButton>
            </div>
          </Card>
        </div>
      )}

      {step === 7 && (
        <div>
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-navy ring-2 ring-brand-gold ring-offset-2">
              <svg className="h-6 w-6 text-brand-warm-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-3 text-xs font-semibold tracking-wide text-brand-gold-dark uppercase">Finish</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-brand-navy">Your sales workspace is ready</h1>
            <p className="mt-1.5 text-sm text-slate-500">{details.companyName}&rsquo;s workspace is set up.</p>
          </div>
          <Card>
            <p className="text-center text-sm text-slate-600">
              {leadPlan === "csv" && "Next, import your existing leads from a spreadsheet."}
              {leadPlan === "manual" && "Next, add your first lead manually."}
              {(leadPlan === "skip" || leadPlan === null) && "You can add leads, invite more teammates, or connect integrations anytime from Settings."}
            </p>
            <ErrorText>{error}</ErrorText>
            <div className="mt-5 flex justify-between">
              <SecondaryButton onClick={() => goTo(6)} disabled={pending}>
                Back
              </SecondaryButton>
              <PrimaryButton
                loading={pending}
                onClick={() => finish(leadPlan === "csv" ? "/leads/import" : leadPlan === "manual" ? "/leads" : "/")}
              >
                {pending ? "Finishing…" : leadPlan === "csv" ? "Go to CSV import" : leadPlan === "manual" ? "Go add a lead" : "Enter dashboard"}
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}
    </OnboardingShell>
  );
}

function TeamStep({
  members,
  onAdd,
  error,
  setError,
  onBack,
  onContinue,
}: {
  members: AddedMember[];
  onAdd: (m: AddedMember) => void;
  error: string | null;
  setError: (e: string | null) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"SALES_MANAGER" | "SALESPERSON">("SALESPERSON");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    startTransition(async () => {
      const result = await addTeamMemberDuringOnboarding({ name, email, role });
      if (result.error || !result.password) {
        setError(result.error ?? "Could not add team member.");
        return;
      }
      onAdd({ name: name.trim(), email: email.trim().toLowerCase(), role, password: result.password });
      setName("");
      setEmail("");
      setRole("SALESPERSON");
    });
  }

  return (
    <div>
      <StepHeader eyebrow="Team" title="Add your sales team" description="Optional — invite people now or later from Team settings." />
      <Card>
        {members.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {members.map((m) => (
              <div key={m.email} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <p className="font-medium text-slate-900">
                  {m.name} · <span className="text-slate-500">{m.role === "SALES_MANAGER" ? "Sales Manager" : "Salesperson"}</span>
                </p>
                <p className="text-slate-500">{m.email}</p>
                <p className="mt-0.5 text-slate-500">
                  Temporary password: <span className="font-mono text-slate-700">{m.password}</span> — share this with them securely.
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Full name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputClass} />
          </Field>
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={selectClass}>
              <option value="SALESPERSON">Salesperson</option>
              <option value="SALES_MANAGER">Sales Manager</option>
            </select>
          </Field>
        </div>
        <div className="mt-3">
          <SecondaryButton type="button" onClick={handleAdd} loading={pending}>
            {pending ? "Adding…" : "Add teammate"}
          </SecondaryButton>
        </div>

        <ErrorText>{error}</ErrorText>

        <div className="mt-5 flex justify-between">
          <SecondaryButton onClick={onBack}>Back</SecondaryButton>
          <PrimaryButton onClick={onContinue}>{members.length > 0 ? "Continue" : "Skip for now"}</PrimaryButton>
        </div>
      </Card>
    </div>
  );
}
