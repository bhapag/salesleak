/**
 * Operator-run CLI for assigning a real pilot customer's FOUNDING plan
 * (Phase 14) — the production-safe "admin method" the phase instructions
 * asked for. Deliberately has NO web-reachable code path: it requires the
 * same access as running a migration or the seed script (repo + database
 * credentials), so it can never be triggered by a normal Owner or by
 * anyone without direct server access. This is distinct from
 * assignFoundingPlanDev() in src/server/actions/billing.ts, which is a
 * convenience button for LOCAL/STAGING testing only and is hard-gated off
 * in production — this script is the real mechanism for a live customer.
 *
 * Usage:
 *   npx tsx scripts/assignFoundingPlan.ts owner@company.com
 *   npx tsx scripts/assignFoundingPlan.ts <companyId>
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const identifier = process.argv[2]?.trim();
  if (!identifier) {
    console.error("Usage: npx tsx scripts/assignFoundingPlan.ts <owner-email-or-companyId>");
    process.exit(1);
  }

  const byEmail = identifier.includes("@")
    ? await prisma.user.findUnique({ where: { email: identifier.toLowerCase() }, select: { companyId: true } })
    : null;
  const companyId = byEmail?.companyId ?? identifier;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    console.error(`No company found for "${identifier}".`);
    process.exit(1);
  }

  const existing = await prisma.subscription.findUnique({ where: { companyId: company.id } });

  await prisma.subscription.upsert({
    where: { companyId: company.id },
    update: { plan: "FOUNDING", status: "ACTIVE", currentPeriodStart: new Date(), cancelAtPeriodEnd: false, cancelledAt: null },
    create: { companyId: company.id, plan: "FOUNDING", status: "ACTIVE", currentPeriodStart: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: null,
      action: "PLAN_CHANGED",
      entityType: "Subscription",
      entityId: company.id,
      metadata: JSON.stringify({ from: existing?.plan ?? null, to: "FOUNDING", via: "operator_script" }),
    },
  });

  console.log(`✓ ${company.name} (${company.id}) is now on the FOUNDING plan, status ACTIVE.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
