import type { FakeDb } from "./fakeDb";

/**
 * Two complete, populated tenants. Cross-tenant tests act as a user from
 * `alpha` and pass real, existing record ids belonging to `beta` — the case
 * that actually matters, rather than malformed or non-existent ids, which
 * any query would reject regardless of scoping.
 */
export const ALPHA = {
  companyId: "company_alpha",
  ownerId: "user_alpha_owner",
  managerId: "user_alpha_manager",
  salespersonId: "user_alpha_sales",
  customerId: "customer_alpha",
  leadId: "lead_alpha",
  taskId: "task_alpha",
  quotationId: "quotation_alpha",
  productId: "product_alpha",
  notificationId: "notification_alpha",
} as const;

export const BETA = {
  companyId: "company_beta",
  ownerId: "user_beta_owner",
  salespersonId: "user_beta_sales",
  customerId: "customer_beta",
  leadId: "lead_beta",
  taskId: "task_beta",
  quotationId: "quotation_beta",
  productId: "product_beta",
  notificationId: "notification_beta",
} as const;

const HOUR = 60 * 60 * 1000;

/**
 * Synthetic, obviously-fake credential material. Never a real hash. The
 * sensitive-data regression suite searches serialized payloads for this exact
 * string, so any path that leaks a User's credential field is caught by value
 * as well as by field name.
 */
export const SYNTHETIC_PASSWORD_HASH = "scrypt$SYNTHETIC$not-a-real-hash";

/** Session tokens are secrets too; same idea. */
export const SYNTHETIC_SESSION_TOKEN_MARKER = "token_";

function company(id: string, name: string) {
  return {
    id,
    name,
    industry: "Manufacturing",
    phone: null,
    email: null,
    city: null,
    state: null,
    timezone: "Asia/Kolkata",
    currency: "INR",
    highValueThreshold: 50000,
    staleQuotationDays: 10,
    defaultFollowUpDays: 3,
    defaultPriority: "MEDIUM",
    lostReasonPresets: null,
    activeLeadSources: null,
    onboardedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

function user(id: string, companyId: string, name: string, email: string, role: string) {
  return {
    id,
    companyId,
    name,
    email,
    role,
    passwordHash: SYNTHETIC_PASSWORD_HASH,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

/**
 * Loads both tenants into the store. Called from a `beforeEach` so every test
 * starts from an identical, deterministic dataset.
 */
export function seedTwoTenants(db: FakeDb): void {
  db.seed("company", [company(ALPHA.companyId, "Alpha Polymers"), company(BETA.companyId, "Beta Plastics")]);

  db.seed("user", [
    user(ALPHA.ownerId, ALPHA.companyId, "Alpha Owner", "owner@alpha.test", "OWNER"),
    user(ALPHA.managerId, ALPHA.companyId, "Alpha Manager", "manager@alpha.test", "SALES_MANAGER"),
    user(ALPHA.salespersonId, ALPHA.companyId, "Alpha Salesperson", "sales@alpha.test", "SALESPERSON"),
    user(BETA.ownerId, BETA.companyId, "Beta Owner", "owner@beta.test", "OWNER"),
    user(BETA.salespersonId, BETA.companyId, "Beta Salesperson", "sales@beta.test", "SALESPERSON"),
  ]);

  // Both companies are in good standing, so a blocked mutation in a test is
  // never ambiguous between "tenant isolation" and "subscription lapsed".
  db.seed("subscription", [
    { id: "sub_alpha", companyId: ALPHA.companyId, plan: "STARTER", status: "ACTIVE", trialEnd: null, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    { id: "sub_beta", companyId: BETA.companyId, plan: "STARTER", status: "ACTIVE", trialEnd: null, currentPeriodEnd: null, cancelAtPeriodEnd: false },
  ]);

  db.seed("customer", [
    { id: ALPHA.customerId, companyId: ALPHA.companyId, name: "Alpha Customer", phone: "9000000001", email: "buyer@alpha-customer.test", createdAt: new Date(), updatedAt: new Date() },
    { id: BETA.customerId, companyId: BETA.companyId, name: "Beta Customer", phone: "9000000002", email: "buyer@beta-customer.test", createdAt: new Date(), updatedAt: new Date() },
  ]);

  db.seed("product", [
    { id: ALPHA.productId, companyId: ALPHA.companyId, name: "Alpha Widget", unitPrice: 100 },
    { id: BETA.productId, companyId: BETA.companyId, name: "Beta Widget", unitPrice: 200 },
  ]);

  db.seed("lead", [
    {
      id: ALPHA.leadId,
      companyId: ALPHA.companyId,
      customerId: ALPHA.customerId,
      ownerId: ALPHA.salespersonId,
      source: "MANUAL",
      status: "NEW",
      priority: "MEDIUM",
      title: "Alpha enquiry",
      estimatedValue: 120000,
      nextAction: "Call back",
      nextActionDeadline: new Date(Date.now() + 24 * HOUR),
      wonAt: null,
      lostAt: null,
      lostReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: BETA.leadId,
      companyId: BETA.companyId,
      customerId: BETA.customerId,
      ownerId: BETA.salespersonId,
      source: "MANUAL",
      status: "NEW",
      priority: "MEDIUM",
      title: "Beta enquiry",
      estimatedValue: 250000,
      nextAction: "Send quote",
      nextActionDeadline: new Date(Date.now() + 24 * HOUR),
      wonAt: null,
      lostAt: null,
      lostReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  db.seed("task", [
    { id: ALPHA.taskId, leadId: ALPHA.leadId, assignedToId: ALPHA.salespersonId, title: "Alpha follow-up", dueDate: new Date(Date.now() + HOUR), status: "PENDING", completedAt: null, createdAt: new Date(), updatedAt: new Date() },
    { id: BETA.taskId, leadId: BETA.leadId, assignedToId: BETA.salespersonId, title: "Beta follow-up", dueDate: new Date(Date.now() + HOUR), status: "PENDING", completedAt: null, createdAt: new Date(), updatedAt: new Date() },
  ]);

  db.seed("quotation", [
    { id: ALPHA.quotationId, companyId: ALPHA.companyId, leadId: ALPHA.leadId, quotationNumber: "ALPHA-001", value: 120000, status: "SENT", sentAt: new Date(), validUntil: null, nextAction: null, followUpDate: null, wonAt: null, lostAt: null, lostReason: null, createdAt: new Date(), updatedAt: new Date() },
    { id: BETA.quotationId, companyId: BETA.companyId, leadId: BETA.leadId, quotationNumber: "BETA-001", value: 250000, status: "SENT", sentAt: new Date(), validUntil: null, nextAction: null, followUpDate: null, wonAt: null, lostAt: null, lostReason: null, createdAt: new Date(), updatedAt: new Date() },
  ]);

  db.seed("notification", [
    { id: ALPHA.notificationId, companyId: ALPHA.companyId, userId: ALPHA.salespersonId, title: "Alpha notice", body: null, isRead: false, createdAt: new Date() },
    { id: BETA.notificationId, companyId: BETA.companyId, userId: BETA.salespersonId, title: "Beta notice", body: null, isRead: false, createdAt: new Date() },
  ]);
}

/**
 * Activity timelines for both tenants, each authored by a real user so the
 * `activities[].user` relation is actually populated.
 *
 * Deliberately NOT part of seedTwoTenants: most isolation tests assert that a
 * refused mutation wrote no activity, and a pre-seeded timeline would make
 * that assertion vacuous. Suites that need a populated timeline opt in.
 */
export function seedActivityHistory(db: FakeDb): void {
  db.seed("activity", [
    { id: "activity_alpha", leadId: ALPHA.leadId, userId: ALPHA.salespersonId, type: "NOTE", notes: "Called the buyer.", createdAt: new Date() },
    { id: "activity_beta", leadId: BETA.leadId, userId: BETA.salespersonId, type: "NOTE", notes: "Sent the quotation.", createdAt: new Date() },
  ]);
}
