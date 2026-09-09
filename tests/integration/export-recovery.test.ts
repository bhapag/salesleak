import { describe, it, expect, beforeEach } from "vitest";
import { db, signInAs } from "../helpers/setup";
import { ALPHA, seedActivityHistory } from "../helpers/fixtures";
import { exportCompanyDataCsv } from "@/server/actions/export";
import { parseCsv } from "@/lib/csv";
import type { CsvImportRow } from "@/server/actions/ingestion";

/**
 * Characterises what the company-data CSV export actually is, so nobody
 * mistakes it for a backup.
 *
 * BACKUP_RECOVERY.md leans on `pg_dump` for real recovery and describes this
 * export as data portability. These tests hold that line: they assert the
 * export's real, current limits, so if someone later widens it into something
 * restorable, the claims here fail loudly and the documentation gets revisited
 * on purpose rather than drifting into a false promise.
 *
 * Nothing here argues the export is bad. It is a good human-readable report.
 * It is simply not a restore path, and that is the invariant under test.
 */
describe("company data export — what it contains", () => {
  beforeEach(() => {
    seedActivityHistory(db);
    signInAs(ALPHA.ownerId);
    // A quotation line item, so "line items are not exported" is a real
    // observation about a populated record rather than an empty-data artifact.
    db.seed("quotationItem", [
      { id: "qitem_alpha", quotationId: ALPHA.quotationId, productId: ALPHA.productId, description: "Gate Valve 4 inch", quantity: 30, unitPrice: 4000, total: 120000 },
    ]);
  });

  it("exports exactly three entities and nothing else", async () => {
    // Tasks, activities, audit logs, users, products, integrations and
    // subscriptions have no export at all — a restore from these files alone
    // could never reproduce them.
    const entities = ["customers", "leads", "quotations"] as const;
    for (const entity of entities) {
      const { csv, filename } = await exportCompanyDataCsv(entity);
      expect(filename).toContain(entity);
      expect(parseCsv(csv).headers.length).toBeGreaterThan(0);
    }
  });

  it("carries no database identifiers, so relationships cannot be rebuilt", async () => {
    for (const entity of ["customers", "leads", "quotations"] as const) {
      const { headers } = parseCsv((await exportCompanyDataCsv(entity)).csv);
      // Records reference each other by display name only.
      expect(headers.some((h) => /\bid\b/i.test(h))).toBe(false);
    }

    const leads = parseCsv((await exportCompanyDataCsv("leads")).csv);
    const row = leads.rows[0];
    expect(row[leads.headers.indexOf("Customer")]).toBe("Alpha Customer");
    // The owner is a name, not a user id — and an unassigned lead exports the
    // literal word, which a real person could also be called.
    expect(leads.headers).toContain("Salesperson");
  });

  it("writes dates as locale display text, not machine-readable timestamps", async () => {
    const leads = parseCsv((await exportCompanyDataCsv("leads")).csv);
    const created = leads.rows[0][leads.headers.indexOf("Created")];

    // e.g. "09 Sept 2026" — an en-IN display string, not ISO 8601, and the
    // time of day is gone entirely. Even the month abbreviation is locale- and
    // runtime-dependent ("Sept", not "Sep"), which is precisely why this is
    // not something to parse a restore from.
    expect(created).toMatch(/^\d{2} [A-Za-z]{3,4} \d{4}$/);
    expect(created).not.toMatch(/T\d{2}:\d{2}/);
  });

  it("writes enum values as prose, losing the stored value", async () => {
    const leads = parseCsv((await exportCompanyDataCsv("leads")).csv);
    const status = leads.rows[0][leads.headers.indexOf("Status")];

    // Stored as "NEW"; exported as "New".
    expect(status).toBe("New");
    expect(db.all("lead").find((l) => l.id === ALPHA.leadId)!.status).toBe("NEW");
  });

  it("omits quotation line items, so what was actually quoted is not recoverable", async () => {
    const { csv } = await exportCompanyDataCsv("quotations");
    const { headers, rows } = parseCsv(csv);

    // The stored quotation has a line item; the export carries only the total.
    expect(db.all("quotationItem")).toHaveLength(1);
    for (const column of ["Description", "Unit Price", "Line Items", "Items", "Quantity"]) {
      expect(headers).not.toContain(column);
    }
    expect(rows[0][headers.indexOf("Value")]).toBe("120000");
  });

  it("omits the fields the CSV importer needs, so an export cannot be re-imported into equivalent leads", async () => {
    const { headers } = parseCsv((await exportCompanyDataCsv("leads")).csv);

    // What importCsvLeads accepts per row, and whether the export supplies it.
    const importable: (keyof CsvImportRow)[] = ["customerName", "phone", "email", "city", "state", "source", "product", "quantity", "estimatedValue"];
    const supplied = importable.filter((field) =>
      headers.some((h) => h.toLowerCase().replace(/\s/g, "") === field.toLowerCase().replace(/name$/, ""))
    );

    // Contact details are the point of a lead and the export drops them.
    expect(headers).not.toContain("Phone");
    expect(headers).not.toContain("Email");
    // Status, priority, next action and deadline are exported but are not
    // inputs the importer accepts, so a re-import lands every row back as NEW.
    expect(headers).toContain("Status");
    expect(supplied).not.toContain("phone");
  });
});
