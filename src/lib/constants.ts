export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "QUOTATION_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export const LEAD_SOURCES = [
  "INDIAMART",
  "JUSTDIAL",
  "EXPORTERS_INDIA",
  "TRADEINDIA",
  "WHATSAPP",
  "EMAIL",
  "WEBSITE",
  "PHONE",
  "REFERRAL",
  "CSV_IMPORT",
  "MANUAL",
] as const;

export const LEAD_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const ACTIVITY_TYPES = ["CALL", "EMAIL", "WHATSAPP", "MEETING", "NOTE", "STATUS_CHANGE"] as const;

export const ACTIVE_STATUSES = LEAD_STATUSES.filter((s) => s !== "WON" && s !== "LOST");

export const QUOTATION_STATUSES = ["DRAFT", "SENT", "FOLLOWED_UP", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

export const QUOTATION_ACTIVE_STATUSES = ["DRAFT", "SENT", "FOLLOWED_UP"] as const;

export const QUOTATION_DISPLAY_STATUSES = ["Draft", "Sent", "Follow-up Due", "Negotiating", "Won", "Lost", "Expired"] as const;

export const CUSTOMER_STATUSES = ["Prospect", "Active Customer", "Repeat Customer", "Dormant", "Lost"] as const;
