import type { LeadPriority, LeadSource } from "@/generated/prisma/client";

/**
 * The one normalized shape every lead source — real or future — must be
 * converted into before touching the database. Connectors/importers only
 * ever produce this; nothing downstream (duplicate detection, customer
 * matching, lead creation) knows or cares which source it came from beyond
 * this struct.
 */
export type NormalizedLeadInput = {
  source: LeadSource;
  externalLeadId?: string | null;
  customerName: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  requirement?: string | null;
  product?: string | null;
  quantity?: string | null;
  estimatedValue?: number | null;
  receivedAt?: Date;
  rawData?: string | null;
  assignToUserId?: string | null;
  priority?: LeadPriority;
  nextAction?: string | null;
  nextActionDeadline?: Date | null;
};

export type IngestStatus = "created" | "duplicate" | "invalid";

export type IngestResult = {
  status: IngestStatus;
  leadId?: string;
  customerId?: string;
  errors?: string[];
  reason?: string;
};
