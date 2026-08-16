import type { SubscriptionPlan } from "@/generated/prisma/client";

export const DEFAULT_TRIAL_DAYS = 14;

export type PlanLimits = {
  /** null = unlimited */
  maxUsers: number | null;
  aiFeatures: boolean;
  advancedReporting: boolean;
  integrations: boolean;
};

export type PlanConfig = {
  id: SubscriptionPlan;
  name: string;
  tagline: string;
  /** null = not self-serve priced ("contact us") */
  priceMonthlyInr: number | null;
  features: string[];
  limits: PlanLimits;
  /** Whether a normal Owner can pick this plan themselves via checkout, vs. it being assigned directly. */
  selfServe: boolean;
};

/**
 * Centralized, placeholder pricing/plan config (Phase 14) — the one place a
 * real price or limit ever needs to change. Nothing else in the app
 * hardcodes a plan name, price, or feature flag; every check reads from
 * here. Prices are illustrative placeholders per this phase's explicit
 * "do not overcomplicate pricing yet" instruction, not a real pricing
 * decision — easy to find and revise later without touching any logic.
 */
export const PLAN_CONFIG: Record<SubscriptionPlan, PlanConfig> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    tagline: "The core SalesLeak workflow for a small sales team.",
    priceMonthlyInr: 1999,
    features: ["Leads, quotations, tasks, customers", "CSV import & manual entry", "Website form connector", "Up to 5 team members"],
    limits: { maxUsers: 5, aiFeatures: false, advancedReporting: false, integrations: false },
    selfServe: true,
  },
  GROWTH: {
    id: "GROWTH",
    name: "Growth",
    tagline: "For teams ready to scale, with AI assistance and more connectors.",
    priceMonthlyInr: 4999,
    features: [
      "Everything in Starter",
      "Unlimited team members",
      "AI Lead Insights, Customer Summary, Sales Brief",
      "IndiaMART & other connectors",
      "Sales Process Health & Pilot Readiness",
    ],
    limits: { maxUsers: null, aiFeatures: true, advancedReporting: true, integrations: true },
    selfServe: true,
  },
  FOUNDING: {
    id: "FOUNDING",
    name: "Founding Customer",
    tagline: "Early-access pricing for our first pilot customers, assigned by the SalesLeak team directly.",
    priceMonthlyInr: null,
    features: ["Everything in Growth", "Locked-in early-customer pricing", "Direct line to the SalesLeak team"],
    limits: { maxUsers: null, aiFeatures: true, advancedReporting: true, integrations: true },
    selfServe: false,
  },
};

export function getPlanConfig(plan: SubscriptionPlan): PlanConfig {
  return PLAN_CONFIG[plan];
}
