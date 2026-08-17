import Image from "next/image";
import type { ReactNode } from "react";

const STEP_LABELS = ["Company", "Team", "Workflow", "Lead sources", "Follow-ups", "Leads", "Finish"];

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProgressNode({ stepNum, currentStep, label }: { stepNum: number; currentStep: number; label: string }) {
  const state = stepNum < currentStep ? "done" : stepNum === currentStep ? "current" : "upcoming";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        aria-current={state === "current" ? "step" : undefined}
        className={
          state === "upcoming"
            ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xs font-medium text-slate-400 transition-colors duration-(--dur-short)"
            : state === "current"
              ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-semibold text-brand-warm-white ring-2 ring-brand-gold ring-offset-2 transition-colors duration-(--dur-short)"
              : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy text-brand-warm-white transition-colors duration-(--dur-short)"
        }
      >
        {state === "done" ? <CheckIcon /> : stepNum}
      </div>
      <span className={`hidden text-[11px] font-medium whitespace-nowrap lg:block ${state === "upcoming" ? "text-slate-400" : "text-slate-600"}`}>{label}</span>
    </div>
  );
}

/** Desktop/tablet: connected line of 7 nodes (labels only at lg+). Mobile: compact "Step X of 7" + bar. */
function ProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div>
      <div className="hidden items-start justify-center md:flex">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          return (
            <div key={label} className="flex items-start">
              <ProgressNode stepNum={stepNum} currentStep={currentStep} label={label} />
              {i < STEP_LABELS.length - 1 && (
                <div className={`mt-3.5 h-px w-6 shrink-0 lg:w-10 ${stepNum < currentStep ? "bg-brand-navy" : "bg-slate-200"} transition-colors duration-(--dur-short)`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="md:hidden">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-500">
            Step {currentStep} of {STEP_LABELS.length}
          </span>
          <span className="font-medium text-brand-navy">{STEP_LABELS[currentStep - 1]}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand-navy transition-[width] duration-(--dur-medium)"
            style={{ width: `${(currentStep / STEP_LABELS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function OnboardingShell({
  currentStep,
  companyName,
  direction,
  children,
}: {
  currentStep: number;
  companyName: string;
  direction: "forward" | "back";
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="flex items-center gap-2">
          <Image src="/brand/salesleak/salesleak-icon-master.png" alt="SalesLeak" width={28} height={28} priority className="shrink-0 rounded-[8px]" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tracking-tight text-brand-navy">SalesLeak</span>
            <span className="text-[10px] text-slate-400">
              by <span className="text-[#B08A45]">NobleArc</span>
            </span>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-500">Setting up {companyName || "your"} workspace</p>
      </div>

      <div className="mb-8">
        <ProgressIndicator currentStep={currentStep} />
      </div>

      <div key={currentStep} className={direction === "forward" ? "step-enter-forward" : "step-enter-back"}>
        {children}
      </div>
    </div>
  );
}

export function StepHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold tracking-wide text-brand-gold-dark uppercase">{eyebrow}</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight text-brand-navy">{title}</h1>
      {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export function SelectionCard({
  selected,
  onClick,
  title,
  description,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-(--dur-micro) disabled:cursor-not-allowed disabled:opacity-60 ${
        selected ? "border-brand-navy bg-brand-navy/5" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span className="flex-1">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </span>
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-(--dur-micro) ${
          selected ? "border-brand-navy bg-brand-navy text-brand-warm-white" : "border-slate-300 bg-white"
        }`}
        aria-hidden="true"
      >
        {selected && <CheckIcon className="h-2.5 w-2.5" />}
      </span>
    </button>
  );
}
