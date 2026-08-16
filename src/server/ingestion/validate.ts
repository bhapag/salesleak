import type { NormalizedLeadInput } from "./types";

/**
 * The one thing a normalized record truly can't be missing: something that
 * identifies who's asking. Every other field is optional and gracefully
 * absent elsewhere in the pipeline — this is the only hard failure.
 */
export function validateNormalizedLead(input: NormalizedLeadInput): string[] {
  const errors: string[] = [];

  if (!input.customerName || !input.customerName.trim()) {
    errors.push("Customer or company name is required.");
  }

  if (input.estimatedValue != null && (Number.isNaN(input.estimatedValue) || input.estimatedValue < 0)) {
    errors.push("Estimated value must be a positive number.");
  }

  if (input.phone && input.phone.replace(/\D/g, "").length < 6) {
    errors.push("Phone number looks invalid.");
  }

  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push("Email address looks invalid.");
  }

  return errors;
}
