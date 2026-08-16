import type { UserRole } from "@/generated/prisma/client";
import type { AuthSession } from "./session";

/**
 * Thrown instead of silently no-op'ing or leaking data when a request
 * targets a record outside the caller's company, or a role without
 * permission for an action. Server actions let this propagate as a plain
 * error (shown via each form's existing try/catch), which is the correct
 * behavior for what should never happen through the normal UI — it's not a
 * "please log in" case, so it doesn't redirect.
 */
export class ForbiddenError extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * The single tenant-isolation check. Every server action or detail query
 * that loads a record by id must call this (or the DB query itself must be
 * scoped by companyId) before returning or mutating it — never trust that an
 * id passed from the client belongs to the caller's company.
 */
export function assertSameCompany(recordCompanyId: string, session: AuthSession): void {
  if (recordCompanyId !== session.companyId) {
    throw new ForbiddenError();
  }
}

const MANAGEMENT_ROLES: UserRole[] = ["OWNER", "SALES_MANAGER"];

/** Team page, reassignment, and salesperson detail management. */
export function canManageTeam(role: UserRole): boolean {
  return MANAGEMENT_ROLES.includes(role);
}

/** Company settings and user creation/role changes. */
export function canManageCompany(role: UserRole): boolean {
  return role === "OWNER";
}

/**
 * Salespeople see only their own leads/quotations/customers; Owner and Sales
 * Manager see the whole company. Returns the ownerId to filter by, or
 * undefined for "no filter — see everyone's."
 */
export function getOwnerScope(session: AuthSession): string | undefined {
  return session.role === "SALESPERSON" ? session.userId : undefined;
}
