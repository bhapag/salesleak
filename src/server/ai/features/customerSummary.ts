import type { ObjectSchema } from "../schema";
import { generateStructured } from "../client";

export type CustomerSummaryInput = {
  name: string;
  city: string | null;
  status: string;
  totalWonValue: number;
  totalLostValue: number;
  totalEnquiries: number;
  totalQuotations: number;
  productsRequested: string[];
  repeatOrderSignal: string;
  repeatOrderEligible: boolean;
  lastOrderDaysAgo: number | null;
  lastActivityDaysAgo: number | null;
  openOpportunities: { title: string; status: string; value: number | null; isOverdue: boolean }[];
};

export type CustomerSummaryResult = {
  summary: string;
  outstandingAction: string | null;
};

const SCHEMA: ObjectSchema = {
  summary: { type: "string", nullable: false },
  outstandingAction: { type: "string", nullable: true },
};

function buildPrompt(input: CustomerSummaryInput) {
  return {
    system:
      "You are a sales-operations assistant for a B2B industrial manufacturer. Given structured data about one " +
      "customer's relationship history, write a short, commercially useful summary (2-4 sentences): what they " +
      "buy, their won/lost history, repeat-order behaviour, and current standing. Then, if there is a genuinely " +
      "outstanding action worth flagging (an overdue opportunity, a customer likely due for reorder), state it " +
      "in one sentence in outstandingAction — otherwise null. Base everything strictly on the given data; never " +
      "invent facts, numbers, or commitments not present in it. Respond with ONLY a JSON object with exactly " +
      "these keys: summary, outstandingAction (string or null).",
    prompt: JSON.stringify(input, null, 2),
  };
}

function mockResult(input: CustomerSummaryInput): CustomerSummaryResult {
  const products = input.productsRequested.length ? input.productsRequested.slice(0, 3).join(", ") : "no specific products yet";
  const wonText =
    input.totalWonValue > 0
      ? `Has won ₹${input.totalWonValue.toLocaleString("en-IN")} in business to date${input.lastOrderDaysAgo != null ? ` (last order ${input.lastOrderDaysAgo} days ago)` : ""}.`
      : "No won orders yet.";
  const repeatText = input.repeatOrderEligible ? ` Repeat-order signal: ${input.repeatOrderSignal}.` : "";

  const overdueOpportunity = input.openOpportunities.find((o) => o.isOverdue);
  const outstandingAction = overdueOpportunity
    ? `"${overdueOpportunity.title}" is overdue and needs follow-up.`
    : input.repeatOrderEligible && input.repeatOrderSignal !== "Normal"
      ? `Customer may be due for a repeat order (${input.repeatOrderSignal}).`
      : null;

  const statusLower = input.status.toLowerCase();
  const article = /^[aeiou]/.test(statusLower) ? "an" : "a";
  const summary =
    `${input.name}${input.city ? ` (${input.city})` : ""} is ${article} ${statusLower}, primarily enquiring about ${products}. ` +
    `${wonText}${repeatText} ${input.openOpportunities.length} open opportunit${input.openOpportunities.length === 1 ? "y" : "ies"} currently.`;

  return { summary, outstandingAction };
}

export async function generateCustomerSummary(companyId: string, input: CustomerSummaryInput) {
  return generateStructured<CustomerSummaryInput, CustomerSummaryResult>({
    feature: "CUSTOMER_SUMMARY",
    companyId,
    input,
    buildPrompt,
    schema: SCHEMA,
    mockResult,
    maxTokens: 500,
  });
}
