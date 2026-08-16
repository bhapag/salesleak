import { prisma } from "@/lib/prisma";
import type { IntegrationType } from "@/generated/prisma/client";

/**
 * The static catalog of connectors the Integrations page shows. This is
 * intentionally not driven entirely by the database — a company that has
 * never had an Integration row created for, say, TradeIndia should still
 * see it listed as "Coming Soon," not be missing a row. `functional` marks
 * connectors real enough to actually use; `webhookCapable` marks the subset
 * with a provider adapter (src/server/ingestion/connectors) that can be set
 * up and tested from this page — CSV/Manual are functional but have no
 * webhook of their own, they're driven from /leads directly.
 */
export const CONNECTOR_CATALOG: { type: IntegrationType; label: string; description: string; functional: boolean; webhookCapable: boolean }[] = [
  {
    type: "INDIAMART",
    label: "IndiaMART",
    description: "Auto-import enquiries from your IndiaMART seller account.",
    functional: true,
    webhookCapable: true,
  },
  { type: "JUSTDIAL", label: "Justdial", description: "Auto-import enquiries from your Justdial listing.", functional: false, webhookCapable: false },
  {
    type: "EXPORTERS_INDIA",
    label: "ExportersIndia",
    description: "Auto-import enquiries from ExportersIndia.",
    functional: false,
    webhookCapable: false,
  },
  { type: "TRADEINDIA", label: "TradeIndia", description: "Auto-import enquiries from TradeIndia.", functional: false, webhookCapable: false },
  {
    type: "WHATSAPP",
    label: "WhatsApp",
    description: "Capture enquiries from WhatsApp Business conversations.",
    functional: false,
    webhookCapable: false,
  },
  { type: "EMAIL", label: "Gmail", description: "Turn enquiry emails into leads automatically.", functional: false, webhookCapable: false },
  {
    type: "WEBSITE",
    label: "Website Forms",
    description: "Capture enquiries submitted through your website's contact form.",
    functional: true,
    webhookCapable: true,
  },
  {
    type: "CSV_IMPORT",
    label: "CSV Import",
    description: "Upload a spreadsheet of enquiries to import in bulk.",
    functional: true,
    webhookCapable: false,
  },
  {
    type: "MANUAL",
    label: "Manual Entry",
    description: "Log enquiries by hand as they come in — by phone, referral, or in person.",
    functional: true,
    webhookCapable: false,
  },
];

export type ConnectorHealth = "healthy" | "warning" | "error" | "unknown";

export type ConnectorView = (typeof CONNECTOR_CATALOG)[number] & {
  status: "NOT_CONNECTED" | "CONNECTED" | "COMING_SOON" | "REQUIRES_SETUP" | "TEST_MODE" | "ERROR";
  enabled: boolean;
  webhookUrl: string | null;
  hasSigningSecret: boolean;
  totalReceived: number;
  lastSyncAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  health: ConnectorHealth;
};

function computeHealth(lastError: string | null, lastSuccessAt: Date | null, webhookCapable: boolean): ConnectorHealth {
  if (!webhookCapable) return "unknown";
  if (lastError) return "error";
  if (lastSuccessAt) return "healthy";
  return "unknown";
}

/** The same default connector rows seed.ts gives demo companies, derived from the catalog so a brand-new signup (Phase 10) never disagrees with seeded data. */
export function getDefaultIntegrationRows(companyId: string) {
  return CONNECTOR_CATALOG.map((c) => ({
    companyId,
    type: c.type,
    status: c.webhookCapable ? ("REQUIRES_SETUP" as const) : c.functional ? ("CONNECTED" as const) : ("COMING_SOON" as const),
    enabled: c.functional && !c.webhookCapable,
  }));
}

export async function getIntegrationsForCompany(companyId: string): Promise<ConnectorView[]> {
  const rows = await prisma.integration.findMany({ where: { companyId } });
  const byType = new Map(rows.map((r) => [r.type, r]));

  return CONNECTOR_CATALOG.map((connector) => {
    const row = byType.get(connector.type);
    const slug = connector.type.toLowerCase().replace(/_/g, "");
    return {
      ...connector,
      status: row?.status ?? (connector.functional && !connector.webhookCapable ? "CONNECTED" : "COMING_SOON"),
      enabled: row?.enabled ?? (connector.functional && !connector.webhookCapable),
      webhookUrl: row?.webhookToken ? `/api/webhooks/${slug}/${row.webhookToken}` : null,
      hasSigningSecret: !!row?.signingSecret,
      totalReceived: row?.totalReceived ?? 0,
      lastSyncAt: row?.lastSyncAt ?? null,
      lastSuccessAt: row?.lastSuccessAt ?? null,
      lastError: row?.lastError ?? null,
      health: computeHealth(row?.lastError ?? null, row?.lastSuccessAt ?? null, connector.webhookCapable),
    };
  });
}

export async function getIngestionHistory(companyId: string, limit = 20) {
  return prisma.ingestionBatch.findMany({
    where: { companyId },
    include: { triggeredBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export type IngestionHistoryEntry = Awaited<ReturnType<typeof getIngestionHistory>>[number];

export async function getFailedIngestions(companyId: string, limit = 20) {
  return prisma.failedIngestion.findMany({
    where: { companyId, status: { in: ["PENDING", "RETRIED"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export type FailedIngestionEntry = Awaited<ReturnType<typeof getFailedIngestions>>[number];
