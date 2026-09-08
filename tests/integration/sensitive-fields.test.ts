import { describe, it, expect, beforeEach } from "vitest";
import { db, signInAs } from "../helpers/setup";
import { ALPHA, SYNTHETIC_PASSWORD_HASH, seedActivityHistory } from "../helpers/fixtures";
import { getWorkQueueForCompany } from "@/server/data/tasks";
import { getMyDayData } from "@/server/data/myDay";
import { getLeadsForCompany, getLeadDetail } from "@/server/data/leads";
import { getQuotationsForCompany, getQuotationDetail } from "@/server/data/quotations";
import { getCustomersForCompany, getCustomerDetail } from "@/server/data/customers";
import { getTeamOverview, getSalespersonDetail } from "@/server/data/team";
import { getDashboardData } from "@/server/data/metrics";

/**
 * Guards the server -> client serialization boundary.
 *
 * Every helper below feeds a Server Component that passes its result into a
 * `"use client"` component (WorkQueueView, TaskActionsCard, LeadsTable,
 * QuotationsTable, CustomersTable, ActivityTimeline, ActivityCard, ...).
 * React serializes those props into the RSC payload delivered to the browser,
 * so anything reachable from these return values is effectively public to the
 * signed-in user.
 *
 * A bare `include: { owner: true }` returns every User scalar, `passwordHash`
 * included. These tests fail if that ever comes back.
 *
 * Two independent checks, because either alone can be fooled:
 *   - by field name, which catches the relation being widened again;
 *   - by value, which catches the same data arriving under a different key
 *     or nested somewhere the field-name walk didn't anticipate.
 */

/** Credential/secret-bearing field names that must never reach a client payload. */
const FORBIDDEN_FIELDS = ["passwordHash", "token"];

function findForbiddenFields(value: unknown, path = "$", found: string[] = [], seen = new WeakSet<object>()): string[] {
  if (value === null || typeof value !== "object") return found;
  if (seen.has(value as object)) return found;
  seen.add(value as object);

  if (Array.isArray(value)) {
    value.forEach((entry, index) => findForbiddenFields(entry, `${path}[${index}]`, found, seen));
    return found;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_FIELDS.includes(key)) found.push(`${path}.${key}`);
    else findForbiddenFields(entry, `${path}.${key}`, found, seen);
  }
  return found;
}

/** Everything reachable from these helpers is client-bound. */
const CLIENT_BOUND_PAYLOADS: Record<string, () => Promise<unknown>> = {
  "getWorkQueueForCompany (/tasks)": () => getWorkQueueForCompany(ALPHA.companyId),
  "getMyDayData (/my-day)": () => getMyDayData(ALPHA.companyId, ALPHA.salespersonId),
  "getLeadsForCompany (/leads)": () => getLeadsForCompany(ALPHA.companyId),
  "getLeadDetail (/leads/[id])": () => getLeadDetail(ALPHA.leadId, ALPHA.companyId),
  "getQuotationsForCompany (/quotations)": () => getQuotationsForCompany(ALPHA.companyId),
  "getQuotationDetail (/quotations/[id])": () => getQuotationDetail(ALPHA.quotationId, ALPHA.companyId),
  "getCustomersForCompany (/customers)": () => getCustomersForCompany(ALPHA.companyId),
  "getCustomerDetail (/customers/[id])": () => getCustomerDetail(ALPHA.customerId, ALPHA.companyId),
  "getTeamOverview (/team)": () => getTeamOverview(ALPHA.companyId),
  "getSalespersonDetail (/team/[id])": () => getSalespersonDetail(ALPHA.companyId, ALPHA.salespersonId),
  "getDashboardData (/)": () => getDashboardData(ALPHA.companyId, ALPHA.ownerId),
};

describe("client-bound payloads never carry credential fields", () => {
  beforeEach(() => {
    // Populates activities[].user, which is one of the relations that used to
    // widen to a full User record.
    seedActivityHistory(db);
    signInAs(ALPHA.ownerId);
  });

  for (const [label, load] of Object.entries(CLIENT_BOUND_PAYLOADS)) {
    it(`${label} exposes no credential field`, async () => {
      const payload = await load();
      expect(findForbiddenFields(payload)).toEqual([]);
    });

    it(`${label} does not serialize the password hash by value`, async () => {
      const payload = await load();
      expect(JSON.stringify(payload) ?? "").not.toContain(SYNTHETIC_PASSWORD_HASH);
    });
  }
});

describe("the guard itself is wired correctly", () => {
  beforeEach(() => {
    seedActivityHistory(db);
    signInAs(ALPHA.ownerId);
  });

  it("the fixture really does carry a password hash, so a clean scan means something", () => {
    // Without this, every assertion above would pass trivially on empty data.
    const users = db.all("user");
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((u) => u.passwordHash === SYNTHETIC_PASSWORD_HASH)).toBe(true);
  });

  it("the scanner detects a credential field when one is present", () => {
    // Proves the walker isn't silently returning [] for everything.
    const contrived = { rows: [{ assignedTo: { id: "u1", name: "A", passwordHash: SYNTHETIC_PASSWORD_HASH } }] };
    expect(findForbiddenFields(contrived)).toEqual(["$.rows[0].assignedTo.passwordHash"]);
  });

  it("the payloads under test are not empty", async () => {
    const workQueue = await getWorkQueueForCompany(ALPHA.companyId);
    const leadDetail = await getLeadDetail(ALPHA.leadId, ALPHA.companyId);

    // An assignee and an activity author are actually present, so the
    // relations that previously leaked are genuinely being exercised.
    expect(workQueue.dueToday.length + workQueue.overdue.length + workQueue.upcoming.length).toBeGreaterThan(0);
    expect(leadDetail?.owner?.name).toBe("Alpha Salesperson");
    expect(leadDetail?.activities.length).toBeGreaterThan(0);
    expect(leadDetail?.activities[0].user?.name).toBe("Alpha Salesperson");
  });
});
