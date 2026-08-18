import { labelize, formatSource } from "@/lib/format";
import type { LeadRisk } from "@/lib/leadRisk";
import type { QuotationDisplayStatus, QuotationRisk } from "@/lib/quotationRisk";
import type { CustomerStatus, RepeatOrderStatus, CustomerSignal } from "@/lib/customerIntelligence";

// Red is reserved for genuine, actionable risk (overdue, high-risk) — a
// closed/dead deal is the opposite of that, so LOST is neutral, not red.
const statusStyles: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700 ring-slate-200",
  CONTACTED: "bg-blue-50 text-blue-700 ring-blue-200",
  QUALIFIED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  QUOTATION_SENT: "bg-amber-50 text-amber-700 ring-amber-200",
  NEGOTIATION: "bg-purple-50 text-purple-700 ring-purple-200",
  WON: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  LOST: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}>
      {labelize(status)}
    </span>
  );
}

const priorityStyles: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600 ring-slate-200",
  MEDIUM: "bg-sky-50 text-sky-700 ring-sky-200",
  HIGH: "bg-orange-50 text-orange-700 ring-orange-200",
  URGENT: "bg-red-50 text-red-700 ring-red-200",
};

export function PriorityBadge({ priority }: { priority: string }) {
  const style = priorityStyles[priority] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}>
      {labelize(priority)}
    </span>
  );
}

// Deliberately muted — a small colored dot for quick scanning, one uniform
// neutral pill style, never competing visually with status/priority/risk
// badges (those are the ones that should draw the eye).
const sourceDotColors: Record<string, string> = {
  INDIAMART: "bg-orange-500",
  JUSTDIAL: "bg-red-500",
  EXPORTERS_INDIA: "bg-teal-500",
  TRADEINDIA: "bg-indigo-500",
  WHATSAPP: "bg-emerald-500",
  EMAIL: "bg-sky-500",
  WEBSITE: "bg-violet-500",
  PHONE: "bg-slate-400",
  REFERRAL: "bg-pink-500",
  CSV_IMPORT: "bg-amber-500",
  MANUAL: "bg-slate-400",
};

export function SourceBadge({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sourceDotColors[source] ?? "bg-slate-400"}`} />
      {formatSource(source)}
    </span>
  );
}

const integrationStatusStyles: Record<string, string> = {
  CONNECTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  NOT_CONNECTED: "bg-slate-100 text-slate-600 ring-slate-200",
  COMING_SOON: "bg-slate-100 text-slate-500 ring-slate-200",
  REQUIRES_SETUP: "bg-amber-50 text-amber-700 ring-amber-200",
  TEST_MODE: "bg-sky-50 text-sky-700 ring-sky-200",
  ERROR: "bg-red-50 text-red-700 ring-red-200",
  DISABLED: "bg-slate-100 text-slate-400 ring-slate-200",
};

const integrationStatusLabels: Record<string, string> = {
  CONNECTED: "Connected",
  NOT_CONNECTED: "Not Connected",
  COMING_SOON: "Coming Soon",
  REQUIRES_SETUP: "Requires Setup",
  TEST_MODE: "Test Mode",
  ERROR: "Error",
  DISABLED: "Disabled",
};

// "Disabled" always wins the display, even if the stored status says
// otherwise — enabled=false is the one truth for on/off, never a second
// status value that could drift out of sync with it.
export function IntegrationStatusBadge({ status, enabled = true }: { status: string; enabled?: boolean }) {
  const effective = enabled ? status : "DISABLED";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        integrationStatusStyles[effective] ?? integrationStatusStyles.NOT_CONNECTED
      }`}
    >
      {integrationStatusLabels[effective] ?? labelize(effective)}
    </span>
  );
}

const healthDotColors: Record<string, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  unknown: "bg-slate-300",
};

export function ConnectorHealthDot({ health, title }: { health: string; title?: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${healthDotColors[health] ?? healthDotColors.unknown}`} title={title} />;
}

export function RiskBadges({ risk }: { risk: LeadRisk }) {
  if (!risk.needsAttention) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {risk.isHighRiskOpportunity && (
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
          High-risk opportunity
        </span>
      )}
      {risk.isOverdue && (
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
          Overdue
        </span>
      )}
      {risk.missingOwner && (
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          Unassigned
        </span>
      )}
      {(risk.missingNextAction || risk.missingDeadline) && (
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          Missing next step
        </span>
      )}
      {risk.isUntouched && (
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          Not yet contacted
        </span>
      )}
    </div>
  );
}

const quotationStatusStyles: Record<QuotationDisplayStatus, string> = {
  Draft: "bg-slate-100 text-slate-600 ring-slate-200",
  Sent: "bg-amber-50 text-amber-700 ring-amber-200",
  "Follow-up Due": "bg-red-50 text-red-700 ring-red-200",
  Negotiating: "bg-purple-50 text-purple-700 ring-purple-200",
  Won: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Lost: "bg-slate-100 text-slate-500 ring-slate-200",
  Expired: "bg-slate-100 text-slate-400 ring-slate-200",
};

export function QuotationStatusBadge({ status }: { status: QuotationDisplayStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${quotationStatusStyles[status]}`}
    >
      {status}
    </span>
  );
}

export function QuotationRiskBadges({ risk }: { risk: QuotationRisk }) {
  if (!risk.needsAttention) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {risk.isHighRiskOpportunity && (
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
          High-risk opportunity
        </span>
      )}
      {risk.isOverdueFollowUp && (
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
          Overdue
        </span>
      )}
      {risk.missingNextAction && (
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          No next action
        </span>
      )}
      {risk.isStale && (
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          No recent activity
        </span>
      )}
    </div>
  );
}

const customerStatusStyles: Record<CustomerStatus, string> = {
  Prospect: "bg-slate-100 text-slate-600 ring-slate-200",
  "Active Customer": "bg-blue-50 text-blue-700 ring-blue-200",
  "Repeat Customer": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Dormant: "bg-amber-50 text-amber-700 ring-amber-200",
  Lost: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${customerStatusStyles[status]}`}
    >
      {status}
    </span>
  );
}

// Only the two states that actually call for action get color: Overdue is
// genuine red risk, Repeat Order Due is amber attention. Normal and Due Soon
// both stay a calm neutral — the text label still distinguishes them, but
// neither is worth competing for attention against the states that matter.
const repeatOrderStyles: Record<RepeatOrderStatus, string> = {
  Normal: "bg-slate-100 text-slate-600 ring-slate-200",
  "Due Soon": "bg-slate-100 text-slate-600 ring-slate-200",
  "Repeat Order Due": "bg-amber-50 text-amber-700 ring-amber-200",
  "Overdue / Dormant": "bg-red-50 text-red-700 ring-red-200",
};

export function RepeatOrderBadge({ eligible, status }: { eligible: boolean; status: RepeatOrderStatus }) {
  if (!eligible) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-200">
        Not enough history
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${repeatOrderStyles[status]}`}
    >
      {status}
    </span>
  );
}

const signalSeverityStyles: Record<CustomerSignal["severity"], string> = {
  critical: "bg-red-50 text-red-700 ring-red-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  info: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function CustomerSignalBadges({ signals }: { signals: CustomerSignal[] }) {
  if (signals.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((s) => (
        <span
          key={s.key}
          className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${signalSeverityStyles[s.severity]}`}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}
