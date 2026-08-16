export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeToNow(date: Date | null | undefined, now: Date = new Date()): string {
  if (!date) return "Never";
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 30) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -30) return `${Math.abs(diffDays)} days ago`;
  return formatDate(date);
}

export function labelize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const SOURCE_LABELS: Record<string, string> = {
  INDIAMART: "IndiaMART",
  JUSTDIAL: "Justdial",
  EXPORTERS_INDIA: "ExportersIndia",
  TRADEINDIA: "TradeIndia",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  WEBSITE: "Website Form",
  PHONE: "Phone Call",
  REFERRAL: "Referral",
  CSV_IMPORT: "CSV/Excel Import",
  MANUAL: "Manual Entry",
};

export function formatSource(source: string): string {
  return SOURCE_LABELS[source] ?? labelize(source);
}
