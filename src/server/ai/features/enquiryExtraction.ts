import type { ObjectSchema } from "../schema";
import { generateStructured } from "../client";

export type EnquiryExtractionInput = { text: string };

export type ExtractedEnquiry = {
  customerName: string | null;
  companyName: string | null;
  product: string | null;
  quantity: string | null;
  location: string | null;
  requirement: string | null;
  urgency: "low" | "normal" | "high" | "urgent" | null;
  purchaseFrequency: string | null;
  phone: string | null;
  email: string | null;
  confidence: number | null;
};

const SCHEMA: ObjectSchema = {
  customerName: { type: "string", nullable: true },
  companyName: { type: "string", nullable: true },
  product: { type: "string", nullable: true },
  quantity: { type: "string", nullable: true },
  location: { type: "string", nullable: true },
  requirement: { type: "string", nullable: true },
  urgency: { type: "enum", values: ["low", "normal", "high", "urgent"], nullable: true },
  purchaseFrequency: { type: "string", nullable: true },
  phone: { type: "string", nullable: true },
  email: { type: "string", nullable: true },
  confidence: { type: "number", nullable: true },
};

function buildPrompt(input: EnquiryExtractionInput) {
  return {
    system:
      "You extract structured lead information from short, often informal B2B industrial sales enquiries " +
      "(WhatsApp messages, marketplace enquiries, phone notes). Extract ONLY information that is explicitly " +
      "present in the text. Never invent, guess, or infer a value that is not actually stated — if something " +
      "is not mentioned, its value must be null. Respond with ONLY a single JSON object with exactly these " +
      "keys: customerName, companyName, product, quantity, location, requirement, urgency " +
      '("low"|"normal"|"high"|"urgent"|null, based only on explicit urgency language), purchaseFrequency, ' +
      "phone, email, confidence (0 to 1, your confidence that customerName and product were correctly identified). " +
      "No prose, no markdown, just the JSON object.",
    prompt: input.text,
  };
}

const PHONE_PATTERN = /(\+?\d[\d\s-]{8,14}\d)/;
const QUANTITY_PATTERN = /\b(\d+(?:\.\d+)?\s?(?:ton|tons|mt|kg|kilograms?|pieces?|pcs|units?|nos)\b)/i;
const NAME_PATTERN = /\b([A-Za-z]+)\s+this side\b/i;
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const URGENCY_WORDS = /\b(urgent(ly)?|asap|immediately)\b/i;

/**
 * Development-mode-only fallback: a few honest regex passes over the raw
 * text, never a fabricated guess. Deliberately limited — this exists so the
 * extraction UI is testable without an API key, not to imitate real
 * language understanding.
 */
function mockResult(input: EnquiryExtractionInput): ExtractedEnquiry {
  const text = input.text;
  const phone = PHONE_PATTERN.exec(text)?.[1]?.trim() ?? null;
  const quantity = QUANTITY_PATTERN.exec(text)?.[1]?.trim() ?? null;
  const customerName = NAME_PATTERN.exec(text)?.[1] ?? null;
  const email = EMAIL_PATTERN.exec(text)?.[0] ?? null;
  const urgency = URGENCY_WORDS.test(text) ? "urgent" : null;

  return {
    customerName: customerName ? customerName[0].toUpperCase() + customerName.slice(1) : null,
    companyName: null,
    product: null,
    quantity,
    location: null,
    requirement: text.trim(),
    urgency,
    purchaseFrequency: null,
    phone,
    email,
    confidence: customerName || phone ? 0.4 : null,
  };
}

export async function extractEnquiry(companyId: string, input: EnquiryExtractionInput) {
  return generateStructured<EnquiryExtractionInput, ExtractedEnquiry>({
    feature: "ENQUIRY_EXTRACTION",
    companyId,
    input,
    buildPrompt,
    schema: SCHEMA,
    mockResult,
    maxTokens: 512,
  });
}
