import type { ObjectSchema } from "../schema";
import { generateStructured } from "../client";

export type SalesBriefInput = {
  totalAtRiskValue: number;
  overdueQuotationCount: number;
  overdueQuotationValue: number;
  uncontactedLeadCount: number;
  uncontactedLeadValue: number;
  missingNextActionCount: number;
  topAttentionItems: { title: string; subtitle: string; amount: number | null; urgencyLabel: string; severity: string }[];
  topRepeatOpportunities: { customerName: string; status: string; estimatedValue: number | null }[];
};

export type SalesBriefResult = { brief: string };

const SCHEMA: ObjectSchema = {
  brief: { type: "string", nullable: false },
};

function buildPrompt(input: SalesBriefInput) {
  return {
    system:
      "You are a sales-operations assistant writing a short management brief for a B2B industrial manufacturer's " +
      "owner. Given already-computed pipeline risk figures and top attention items for today, write a concise " +
      "brief as 3-5 short bullet lines (each starting with '- '): the biggest risk today, the highest-value " +
      "overdue opportunity, any important customer follow-up, and repeat-order opportunities worth mentioning. " +
      "Maximum useful information, minimum words — no filler sentences, no restating every number given. Base " +
      "everything strictly on the given data; never invent figures, names, or facts not present in it. This is " +
      "supplementary to, not a replacement for, the dashboard's own Money at Risk figures. Respond with ONLY a " +
      "JSON object with exactly this key: brief (a single string containing the bullet lines separated by \\n).",
    prompt: JSON.stringify(input, null, 2),
  };
}

function mockResult(input: SalesBriefInput): SalesBriefResult {
  const lines: string[] = [];

  if (input.totalAtRiskValue > 0) {
    lines.push(`- ₹${input.totalAtRiskValue.toLocaleString("en-IN")} in revenue is currently at risk across the pipeline.`);
  }
  const topItem = input.topAttentionItems[0];
  if (topItem) {
    lines.push(`- Highest-priority item: "${topItem.title}" — ${topItem.urgencyLabel}${topItem.amount ? ` (₹${topItem.amount.toLocaleString("en-IN")})` : ""}.`);
  }
  if (input.overdueQuotationCount > 0) {
    lines.push(`- ${input.overdueQuotationCount} quotation follow-up(s) overdue, worth ₹${input.overdueQuotationValue.toLocaleString("en-IN")}.`);
  }
  if (input.uncontactedLeadCount > 0) {
    lines.push(`- ${input.uncontactedLeadCount} lead(s) not yet contacted, worth ₹${input.uncontactedLeadValue.toLocaleString("en-IN")}.`);
  }
  const topRepeat = input.topRepeatOpportunities[0];
  if (topRepeat) {
    lines.push(`- Repeat-order opportunity: ${topRepeat.customerName} (${topRepeat.status}).`);
  }
  if (lines.length === 0) {
    lines.push("- Nothing urgent stands out today — the pipeline looks on track.");
  }

  return { brief: lines.join("\n") };
}

export async function generateSalesBrief(companyId: string, input: SalesBriefInput) {
  return generateStructured<SalesBriefInput, SalesBriefResult>({
    feature: "SALES_BRIEF",
    companyId,
    input,
    buildPrompt,
    schema: SCHEMA,
    mockResult,
    maxTokens: 500,
  });
}
