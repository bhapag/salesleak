import type { ParseResult } from "./types";
import type { NormalizedLeadInput } from "../types";

/**
 * Preparation only — no live inbox is connected, no OAuth, no route. This
 * exists so a future Gmail/IMAP connector has a normalization target to
 * build against instead of inventing one under time pressure. Deliberately
 * NOT registered in connectors/registry.ts (nothing should be able to POST
 * to an "email webhook" that doesn't actually receive email yet).
 */
export type EmailPayload = {
  from: string; // "Name <email@example.com>" or bare "email@example.com"
  to: string;
  subject: string;
  body: string;
  receivedAt: string;
  attachments?: { filename: string; sizeBytes: number }[];
};

function splitFromHeader(from: string): { name: string | null; email: string | null } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (match) {
    const name = match[1].trim();
    return { name: name || null, email: match[2].trim() };
  }
  const bareEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from.trim()) ? from.trim() : null;
  return { name: null, email: bareEmail };
}

/**
 * Deliberately conservative: without real parsing/AI, the only fields an
 * email reliably gives us are sender identity and a requirement blob (the
 * body, truncated). Product/quantity/value are left null — a future phase
 * can layer structured or AI-assisted extraction on top without changing
 * this contract.
 */
export function parseEmailPayload(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Payload must be a JSON object." };
  }
  const payload = raw as Partial<EmailPayload>;
  if (!payload.from) return { ok: false, error: "Missing sender (from)." };

  const { name, email } = splitFromHeader(payload.from);
  const customerName = name || email;
  if (!customerName) return { ok: false, error: "Could not identify a sender name or email." };

  const input: NormalizedLeadInput = {
    source: "EMAIL",
    customerName,
    email,
    requirement: payload.subject ? `${payload.subject}\n\n${payload.body ?? ""}`.trim() : (payload.body ?? null),
    receivedAt: payload.receivedAt ? new Date(payload.receivedAt) : undefined,
    rawData: JSON.stringify(payload),
  };

  return { ok: true, input };
}
