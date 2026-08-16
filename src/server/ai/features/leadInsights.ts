import type { ObjectSchema } from "../schema";
import { generateStructured } from "../client";

/**
 * Deliberately a condensed, whitelisted digest — never the raw Lead/
 * Customer/Quotation rows. Nothing here can carry a secret (passwords,
 * session tokens, webhook/signing secrets) because those fields simply
 * aren't part of this shape; the caller (server/actions/ai.ts) builds this
 * from already company-scoped data one field at a time, never `{...lead}`.
 */
export type LeadInsightInput = {
  title: string;
  product: string | null;
  quantity: string | null;
  estimatedValue: number | null;
  status: string;
  priority: string;
  source: string;
  customerName: string;
  customerCity: string | null;
  daysSinceCreated: number;
  nextAction: string | null;
  nextActionDeadline: string | null;
  isOverdue: boolean;
  isUntouched: boolean;
  missingOwner: boolean;
  recentNotes: string[];
  quotations: { status: string; value: number; daysSinceSent: number | null; followUpOverdue: boolean }[];
  customerWonCount: number;
  customerRepeatSignal: string | null;
};

export const PRIORITY_SIGNALS = ["High potential", "Medium potential", "Low information", "Urgent attention"] as const;
export type PrioritySignal = (typeof PRIORITY_SIGNALS)[number];

export type LeadInsights = {
  summary: string;
  prioritySignal: PrioritySignal;
  priorityReason: string;
  nextActionSuggestion: string;
  nextActionReason: string;
  suggestedDeadlineDays: number;
};

const SCHEMA: ObjectSchema = {
  summary: { type: "string", nullable: false },
  prioritySignal: { type: "enum", values: PRIORITY_SIGNALS, nullable: false },
  priorityReason: { type: "string", nullable: false },
  nextActionSuggestion: { type: "string", nullable: false },
  nextActionReason: { type: "string", nullable: false },
  suggestedDeadlineDays: { type: "number", nullable: false },
};

function buildPrompt(input: LeadInsightInput) {
  return {
    system:
      "You are a sales-operations assistant for a B2B industrial manufacturer. Given structured data about one " +
      "sales lead, produce: a short factual summary (2-3 sentences, no fluff, only facts present in the data), " +
      "an advisory priority signal, a one-sentence reason for that signal, a concrete next-action suggestion " +
      "(specific, actionable, e.g. 'Call to confirm exact quantity' not 'follow up'), a one-sentence reason for " +
      "the suggestion, and a suggested deadline in days (1-14) for that action. This signal is ADVISORY ONLY — " +
      "it never changes who owns the lead, its status, or any pricing. Base everything strictly on the given " +
      "data; never invent facts, quotes, or commitments not present in it. Respond with ONLY a JSON object with " +
      "exactly these keys: summary, prioritySignal (one of \"High potential\", \"Medium potential\", " +
      '"Low information", "Urgent attention"), priorityReason, nextActionSuggestion, nextActionReason, ' +
      "suggestedDeadlineDays (integer).",
    prompt: JSON.stringify(input, null, 2),
  };
}

function mockResult(input: LeadInsightInput): LeadInsights {
  const latestQuotation = input.quotations[0] ?? null;
  const hasOverdueQuotationFollowUp = input.quotations.some((q) => q.followUpOverdue);
  const isHighValue = (input.estimatedValue ?? 0) >= 50_000 || input.priority === "HIGH" || input.priority === "URGENT";

  let prioritySignal: PrioritySignal;
  let priorityReason: string;
  if ((input.isOverdue || hasOverdueQuotationFollowUp) && isHighValue) {
    prioritySignal = "Urgent attention";
    priorityReason = "A high-value opportunity has an overdue follow-up.";
  } else if (input.missingOwner || input.isUntouched || (!input.nextAction && input.status !== "WON" && input.status !== "LOST")) {
    prioritySignal = "Low information";
    priorityReason = "Key fields (owner, contact, or next action) are still missing.";
  } else if (input.isOverdue || hasOverdueQuotationFollowUp) {
    prioritySignal = "Urgent attention";
    priorityReason = "A follow-up on this opportunity is overdue.";
  } else if (isHighValue) {
    prioritySignal = "High potential";
    priorityReason = "Estimated value or priority marks this as a significant opportunity.";
  } else {
    prioritySignal = "Medium potential";
    priorityReason = "A standard opportunity with no immediate red flags.";
  }

  let nextActionSuggestion: string;
  let nextActionReason: string;
  let suggestedDeadlineDays: number;
  if (!input.product || !input.quantity) {
    nextActionSuggestion = "Call to confirm exact product and quantity required.";
    nextActionReason = "Requirement details are incomplete, which blocks preparing an accurate quotation.";
    suggestedDeadlineDays = 2;
  } else if (latestQuotation && hasOverdueQuotationFollowUp) {
    nextActionSuggestion = `Follow up on the ${latestQuotation.status.toLowerCase()} quotation.`;
    nextActionReason = "The scheduled follow-up on the sent quotation has passed its date.";
    suggestedDeadlineDays = 1;
  } else if (!latestQuotation && input.status !== "NEW") {
    nextActionSuggestion = "Prepare and send a quotation.";
    nextActionReason = "Customer has been contacted but no quotation has been sent yet.";
    suggestedDeadlineDays = 2;
  } else if (input.isUntouched) {
    nextActionSuggestion = "Call to acknowledge the enquiry and understand the requirement.";
    nextActionReason = "This enquiry has not been contacted since it was created.";
    suggestedDeadlineDays = 1;
  } else {
    nextActionSuggestion = "Confirm purchase timeline with the customer.";
    nextActionReason = "No immediate blocker — a timeline check keeps the opportunity moving.";
    suggestedDeadlineDays = 3;
  }

  const valueText = input.estimatedValue ? ` (~₹${input.estimatedValue.toLocaleString("en-IN")})` : "";
  const quantityText = input.quantity ? `${input.quantity} of ` : "";
  const quotationText = latestQuotation
    ? `Quotation is currently ${latestQuotation.status.toLowerCase()}${latestQuotation.followUpOverdue ? " and follow-up is overdue" : ""}.`
    : "No quotation has been sent yet.";
  const repeatText =
    input.customerWonCount > 0 ? ` ${input.customerName} has ${input.customerWonCount} prior won order(s) with this signal: ${input.customerRepeatSignal ?? "unknown"}.` : "";

  const summary =
    `${input.customerName} requires ${quantityText}${input.product ?? "an unspecified product"}${valueText}. ` +
    `${quotationText}${repeatText}`;

  return { summary, prioritySignal, priorityReason, nextActionSuggestion, nextActionReason, suggestedDeadlineDays };
}

export async function generateLeadInsights(companyId: string, input: LeadInsightInput) {
  return generateStructured<LeadInsightInput, LeadInsights>({
    feature: "LEAD_INSIGHTS",
    companyId,
    input,
    buildPrompt,
    schema: SCHEMA,
    mockResult,
    maxTokens: 700,
  });
}
