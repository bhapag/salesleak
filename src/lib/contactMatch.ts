/**
 * Pure contact-normalization helpers shared by the server-side duplicate
 * checker (src/server/ingestion/duplicates.ts) and the CSV import wizard's
 * client-side preview, so both compute "is this the same contact" the exact
 * same way.
 */

/** Strips everything but digits and keeps the last 10 — handles +91, spaces, dashes, etc. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.slice(-10);
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}
