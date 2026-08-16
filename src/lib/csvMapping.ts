/**
 * Reusable CSV-column -> SalesLeak-field mapping. Deliberately independent
 * of any one CSV format: auto-detection is just a best-effort suggestion the
 * user can override in the mapping UI, never assumed correct.
 */
export type LeadImportField =
  | "customerName"
  | "companyName"
  | "phone"
  | "email"
  | "city"
  | "state"
  | "source"
  | "product"
  | "requirement"
  | "quantity"
  | "estimatedValue"
  | "assignedSalesperson"
  | "receivedAt";

export const LEAD_IMPORT_FIELDS: { key: LeadImportField; label: string; required?: boolean }[] = [
  { key: "customerName", label: "Customer / Contact Name", required: true },
  { key: "companyName", label: "Company Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "source", label: "Lead Source" },
  { key: "product", label: "Product" },
  { key: "requirement", label: "Requirement / Description" },
  { key: "quantity", label: "Quantity" },
  { key: "estimatedValue", label: "Estimated Value" },
  { key: "assignedSalesperson", label: "Assigned Salesperson" },
  { key: "receivedAt", label: "Date" },
];

const SYNONYMS: Record<LeadImportField, string[]> = {
  customerName: ["name", "customer", "customer name", "contact", "contact name", "contact person"],
  companyName: ["company", "company name", "organisation", "organization", "firm"],
  phone: ["phone", "mobile", "contact number", "phone number", "whatsapp", "mobile number"],
  email: ["email", "email address", "e-mail"],
  city: ["city", "location", "town"],
  state: ["state", "region"],
  source: ["source", "lead source", "channel", "origin"],
  product: ["product", "item", "sku"],
  requirement: ["requirement", "description", "enquiry", "message", "notes", "details"],
  quantity: ["quantity", "qty", "units"],
  estimatedValue: ["estimated value", "value", "amount", "budget", "estimated amount", "deal size"],
  assignedSalesperson: ["assigned salesperson", "salesperson", "owner", "assigned to", "sales rep", "rep"],
  receivedAt: ["date", "received", "received date", "enquiry date", "created", "created date"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

/** Best-effort auto-mapping from CSV headers to SalesLeak fields, by exact-normalized-match against known synonyms. */
export function autoMapColumns(headers: string[]): Partial<Record<LeadImportField, string>> {
  const mapping: Partial<Record<LeadImportField, string>> = {};
  const normalizedHeaders = headers.map(normalizeHeader);

  for (const field of LEAD_IMPORT_FIELDS) {
    const synonyms = SYNONYMS[field.key];
    const idx = normalizedHeaders.findIndex((h) => synonyms.includes(h));
    if (idx !== -1) mapping[field.key] = headers[idx];
  }

  return mapping;
}

const SOURCE_TEXT_MATCH: Record<string, string> = {
  indiamart: "INDIAMART",
  justdial: "JUSTDIAL",
  exportersindia: "EXPORTERS_INDIA",
  "exporters india": "EXPORTERS_INDIA",
  tradeindia: "TRADEINDIA",
  "trade india": "TRADEINDIA",
  whatsapp: "WHATSAPP",
  email: "EMAIL",
  gmail: "EMAIL",
  website: "WEBSITE",
  "website form": "WEBSITE",
  phone: "PHONE",
  "phone call": "PHONE",
  call: "PHONE",
  referral: "REFERRAL",
  csv: "CSV_IMPORT",
  "csv import": "CSV_IMPORT",
  manual: "MANUAL",
  "manual entry": "MANUAL",
};

/** Matches free-text CSV values ("IndiaMART", "phone call", ...) to a LeadSource enum value, or null if unrecognized. */
export function matchLeadSource(text: string | null | undefined): string | null {
  if (!text) return null;
  return SOURCE_TEXT_MATCH[normalizeHeader(text)] ?? null;
}

/** Parses a currency-ish value ("₹1,20,000", "120000.50") into a number, or null if not parseable. */
export function parseEstimatedValue(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parses a loosely-formatted date string into an ISO date, or null if not parseable. */
export function parseCsvDate(text: string | null | undefined): string | null {
  if (!text || !text.trim()) return null;
  const d = new Date(text.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
