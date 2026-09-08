import { describe, it, expect } from "vitest";
import { db, signInAs } from "../helpers/setup";
import { ALPHA } from "../helpers/fixtures";
import { ForbiddenError } from "@/server/auth/permissions";
import { createTeamUser, updateUserRole, setUserActive } from "@/server/actions/users";
import { updateCompanySettings, type CompanySettingsInput } from "@/server/actions/company";
import { exportCompanyDataCsv } from "@/server/actions/export";
import { completeOnboarding } from "@/server/actions/onboarding";
import { generateWebhookConfig, toggleIntegrationEnabled } from "@/server/actions/integrations";

const SETTINGS: CompanySettingsInput = {
  name: "Renamed By Attacker",
  industry: "Manufacturing",
  phone: "",
  email: "",
  city: "",
  state: "",
  timezone: "Asia/Kolkata",
  currency: "INR",
  highValueThreshold: 50000,
  staleQuotationDays: 10,
  defaultFollowUpDays: 3,
  defaultPriority: "MEDIUM",
  lostReasonPresets: [],
  activeLeadSources: [],
};

function alphaCompany() {
  return db.all("company").find((c) => c.id === ALPHA.companyId)!;
}

describe("Owner-only operations", () => {
  it("a SALESPERSON cannot change company settings", async () => {
    signInAs(ALPHA.salespersonId);

    await expect(updateCompanySettings(SETTINGS)).rejects.toBeInstanceOf(ForbiddenError);

    expect(alphaCompany().name).toBe("Alpha Polymers");
  });

  it("a SALES_MANAGER cannot change company settings either", async () => {
    signInAs(ALPHA.managerId);

    await expect(updateCompanySettings(SETTINGS)).rejects.toBeInstanceOf(ForbiddenError);

    expect(alphaCompany().name).toBe("Alpha Polymers");
  });

  it("the OWNER can change company settings", async () => {
    signInAs(ALPHA.ownerId);

    const result = await updateCompanySettings({ ...SETTINGS, name: "Alpha Polymers Ltd" });

    expect(result.error).toBeUndefined();
    expect(alphaCompany().name).toBe("Alpha Polymers Ltd");
  });

  it("company settings are always written to the caller's own company", async () => {
    signInAs(ALPHA.ownerId);

    await updateCompanySettings({ ...SETTINGS, name: "Alpha Renamed" });

    // Beta is untouched — there is no client-supplied companyId to redirect the write.
    expect(db.all("company").find((c) => c.id === "company_beta")!.name).toBe("Beta Plastics");
  });

  it("a SALESPERSON cannot create a team member", async () => {
    signInAs(ALPHA.salespersonId);

    await expect(createTeamUser({ name: "New", email: "new@alpha.test", password: "password123", role: "SALESPERSON" })).rejects.toBeInstanceOf(
      ForbiddenError
    );

    expect(db.all("user").some((u) => u.email === "new@alpha.test")).toBe(false);
  });

  it("a SALES_MANAGER cannot create a team member", async () => {
    signInAs(ALPHA.managerId);

    await expect(createTeamUser({ name: "New", email: "new@alpha.test", password: "password123", role: "SALESPERSON" })).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it("the OWNER can create a team member, scoped to their own company", async () => {
    signInAs(ALPHA.ownerId);

    const result = await createTeamUser({ name: "New Hire", email: "new@alpha.test", password: "password123", role: "SALESPERSON" });

    expect(result.error).toBeUndefined();
    const created = db.all("user").find((u) => u.email === "new@alpha.test")!;
    expect(created.companyId).toBe(ALPHA.companyId);
    // The password is never stored in the clear.
    expect(created.passwordHash).not.toContain("password123");
  });

  it("a SALESPERSON cannot change roles", async () => {
    signInAs(ALPHA.salespersonId);

    await expect(updateUserRole(ALPHA.salespersonId, "OWNER")).rejects.toBeInstanceOf(ForbiddenError);

    expect(db.all("user").find((u) => u.id === ALPHA.salespersonId)!.role).toBe("SALESPERSON");
  });

  it("a SALES_MANAGER cannot promote themselves to OWNER", async () => {
    signInAs(ALPHA.managerId);

    await expect(updateUserRole(ALPHA.managerId, "OWNER")).rejects.toBeInstanceOf(ForbiddenError);

    expect(db.all("user").find((u) => u.id === ALPHA.managerId)!.role).toBe("SALES_MANAGER");
  });

  it("a SALESPERSON cannot deactivate a colleague", async () => {
    signInAs(ALPHA.salespersonId);

    await expect(setUserActive(ALPHA.managerId, false)).rejects.toBeInstanceOf(ForbiddenError);

    expect(db.all("user").find((u) => u.id === ALPHA.managerId)!.isActive).toBe(true);
  });

  it("a SALESPERSON cannot export company data", async () => {
    signInAs(ALPHA.salespersonId);
    await expect(exportCompanyDataCsv("leads")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("a SALES_MANAGER cannot export company data", async () => {
    signInAs(ALPHA.managerId);
    await expect(exportCompanyDataCsv("customers")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("an export by the OWNER contains only their own company's rows", async () => {
    signInAs(ALPHA.ownerId);

    const { csv } = await exportCompanyDataCsv("leads");

    expect(csv).toContain("Alpha enquiry");
    expect(csv).not.toContain("Beta enquiry");
  });

  it("a SALESPERSON cannot complete onboarding", async () => {
    signInAs(ALPHA.salespersonId);
    await expect(completeOnboarding()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("Last-Owner protection", () => {
  it("refuses to demote the only active Owner", async () => {
    signInAs(ALPHA.ownerId);

    await expect(updateUserRole(ALPHA.ownerId, "SALES_MANAGER")).rejects.toThrow(/at least one active Owner/);

    expect(db.all("user").find((u) => u.id === ALPHA.ownerId)!.role).toBe("OWNER");
  });

  it("allows demoting an Owner once a second active Owner exists", async () => {
    signInAs(ALPHA.ownerId);
    await updateUserRole(ALPHA.managerId, "OWNER");

    await updateUserRole(ALPHA.ownerId, "SALES_MANAGER");

    expect(db.all("user").find((u) => u.id === ALPHA.ownerId)!.role).toBe("SALES_MANAGER");
    expect(db.all("user").filter((u) => u.companyId === ALPHA.companyId && u.role === "OWNER" && u.isActive)).toHaveLength(1);
  });

  it("counts only the caller's own company when checking for a remaining Owner", async () => {
    // Beta has its own active Owner; that must not satisfy Alpha's requirement.
    signInAs(ALPHA.ownerId);

    await expect(updateUserRole(ALPHA.ownerId, "SALESPERSON")).rejects.toThrow(/at least one active Owner/);
  });

  it("refuses self-deactivation", async () => {
    signInAs(ALPHA.ownerId);

    await expect(setUserActive(ALPHA.ownerId, false)).rejects.toThrow(/can't deactivate your own account/);

    expect(db.all("user").find((u) => u.id === ALPHA.ownerId)!.isActive).toBe(true);
  });

  it("deactivating a user ends their sessions immediately", async () => {
    signInAs(ALPHA.salespersonId);
    expect(db.all("session").some((s) => s.userId === ALPHA.salespersonId)).toBe(true);

    signInAs(ALPHA.ownerId);
    await setUserActive(ALPHA.salespersonId, false);

    expect(db.all("session").some((s) => s.userId === ALPHA.salespersonId)).toBe(false);
  });
});

describe("Owner-and-Manager operations (canManageTeam)", () => {
  it("a SALESPERSON cannot configure an integration webhook", async () => {
    signInAs(ALPHA.salespersonId);
    await expect(generateWebhookConfig("WEBSITE")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("a SALESPERSON cannot enable or disable an integration", async () => {
    signInAs(ALPHA.salespersonId);
    await expect(toggleIntegrationEnabled("WEBSITE", true)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("a SALES_MANAGER is permitted past the role gate for integrations", async () => {
    signInAs(ALPHA.managerId);

    // No Integration row is seeded, so this must fail on the missing record,
    // never on the role check — proving the manager passed the gate.
    const error = await toggleIntegrationEnabled("WEBSITE", true).catch((e: unknown) => e as Error);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect((error as Error).message).not.toContain("Sales Managers");
  });
});

describe("Acting-user attribution", () => {
  it("audit entries record the session user, not a client-supplied id", async () => {
    signInAs(ALPHA.ownerId);

    await createTeamUser({ name: "Audited", email: "audited@alpha.test", password: "password123", role: "SALESPERSON" });

    const entry = db.all("auditLog").find((a) => a.action === "USER_CREATED")!;
    expect(entry.userId).toBe(ALPHA.ownerId);
    expect(entry.companyId).toBe(ALPHA.companyId);
  });
});
