import type { Prisma } from "@/generated/prisma/client";

/**
 * Explicit User projections for anything that can reach a client component.
 *
 * A bare `include: { owner: true }` returns every User scalar — including
 * `passwordHash`. Most of this app's data helpers feed Server Components
 * that pass their result straight into a `"use client"` component, and React
 * serializes those props into the RSC payload sent to the browser. So a
 * broad include is not just untidy: it publishes the password hash of every
 * user attached to a visible record.
 *
 * These constants exist so the safe field set is written down once. Use
 * `select` rather than `include` for User relations in any helper whose
 * result is rendered.
 */

/**
 * Identity only — what the UI needs to print "Assigned to Priya" or filter a
 * table by owner. Every client-bound `owner`, `assignedTo`, and
 * `activity.user` relation uses this; nothing rendered from those relations
 * reads more than the id and the name.
 */
export const USER_DISPLAY_SELECT = {
  id: true,
  name: true,
} as const satisfies Prisma.UserSelect;

/**
 * The team-management views additionally show each person's role and whether
 * their account is still active. Still no credential material.
 */
export const USER_TEAM_SELECT = {
  id: true,
  name: true,
  role: true,
  isActive: true,
} as const satisfies Prisma.UserSelect;

export type UserDisplay = Prisma.UserGetPayload<{ select: typeof USER_DISPLAY_SELECT }>;
export type UserTeamSummary = Prisma.UserGetPayload<{ select: typeof USER_TEAM_SELECT }>;
