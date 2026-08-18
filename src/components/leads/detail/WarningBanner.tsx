import type { LeadDetail } from "@/server/data/leads";

// Swaps the generic "deadline has passed" reason for a concrete day count
// when we know the deadline — "Follow-up overdue by 2 days" is more
// actionable than a vague warning, and reads as calm fact rather than alarm.
function concreteReasons(lead: LeadDetail): string[] {
  if (!lead.risk.isOverdue || !lead.nextActionDeadline) return lead.risk.reasons;

  const days = Math.floor((Date.now() - lead.nextActionDeadline.getTime()) / (1000 * 60 * 60 * 24));
  const overdueLabel = days < 1 ? "Follow-up overdue today" : `Follow-up overdue by ${days} day${days === 1 ? "" : "s"}`;

  return lead.risk.reasons.map((r) => (r === "Next-action deadline has passed" ? overdueLabel : r));
}

export function WarningBanner({ lead }: { lead: LeadDetail }) {
  const { risk } = lead;
  if (!risk.needsAttention) return null;

  const reasons = concreteReasons(lead);

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
        risk.isHighRiskOpportunity ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className={`mt-0.5 h-5 w-5 shrink-0 ${risk.isHighRiskOpportunity ? "text-red-500" : "text-amber-500"}`}>
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l6.516 11.598c.75 1.334-.213 2.98-1.743 2.98H3.484c-1.53 0-2.492-1.646-1.743-2.98L8.257 3.1zM10 7a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 7zm0 8a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      <div>
        <p className={`text-sm font-semibold ${risk.isHighRiskOpportunity ? "text-red-800" : "text-amber-800"}`}>
          {risk.isHighRiskOpportunity ? "High-risk opportunity — needs attention now" : "This lead needs attention"}
        </p>
        <ul className={`mt-1 list-inside list-disc text-sm ${risk.isHighRiskOpportunity ? "text-red-700" : "text-amber-700"}`}>
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
