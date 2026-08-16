import { prisma } from "@/lib/prisma";
import { stripeProvider } from "./providers/stripe";
import { logger } from "@/lib/logger";

export type WebhookResult = { httpStatus: number; body: Record<string, unknown> };

/**
 * Idempotency without a new event-dedup table: check for an existing
 * AuditLog row carrying this Stripe event id (stored as entityType
 * "StripeEvent", entityId = event.id) before doing any work. The
 * Subscription field writes themselves are naturally idempotent (setting
 * status to the same value twice ends in the same state); this guard exists
 * so a Stripe retry doesn't also write a second, duplicate audit trail.
 */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({ where: { entityType: "StripeEvent", entityId: eventId }, select: { id: true } });
  return !!existing;
}

async function recordProcessed(companyId: string, eventId: string, eventType: string, summary: string) {
  await prisma.auditLog.create({
    data: { companyId, userId: null, action: "SUBSCRIPTION_WEBHOOK_PROCESSED", entityType: "StripeEvent", entityId: eventId, metadata: JSON.stringify({ eventType, summary }) },
  });
}

/** checkout.session.completed carries the company id we set as metadata/client_reference_id at creation; every later event only carries the Stripe customer id, so those look it up against what we stored on that first checkout. */
async function findCompanyIdForEvent(obj: Record<string, unknown>): Promise<string | null> {
  const metadata = obj.metadata as Record<string, string> | undefined;
  if (metadata?.companyId) return metadata.companyId;
  if (typeof obj.client_reference_id === "string" && obj.client_reference_id) return obj.client_reference_id;

  const customerId = typeof obj.customer === "string" ? obj.customer : null;
  if (!customerId) return null;
  const sub = await prisma.subscription.findFirst({ where: { billingCustomerId: customerId }, select: { companyId: true } });
  return sub?.companyId ?? null;
}

/**
 * The only place a Subscription row is ever updated from Stripe. Never
 * trusts anything from the client — every field here comes from a payload
 * whose signature was already verified by the caller. `upsert` throughout
 * rather than `update`, since Stripe explicitly does not guarantee event
 * delivery order (a customer.subscription.updated could in principle arrive
 * before this handler has ever seen a checkout.session.completed for that
 * company).
 */
export async function handleStripeWebhook(rawBody: string, signatureHeader: string | null): Promise<WebhookResult> {
  const verified = stripeProvider.verifyWebhookSignature(rawBody, signatureHeader);
  if (!verified.ok) {
    logger.billingFailure(verified.error);
    return { httpStatus: 400, body: { error: verified.error } };
  }

  const event = verified.event;
  if (await alreadyProcessed(event.id)) {
    return { httpStatus: 200, body: { received: true, duplicate: true } };
  }

  const obj = event.data.object;
  const companyId = await findCompanyIdForEvent(obj);
  if (!companyId) {
    logger.billingFailure("Stripe webhook event could not be matched to a company.", { eventId: event.id, eventType: event.type });
    // 200, not an error status — this event just isn't actionable for us; a
    // non-2xx would make Stripe retry it forever for no benefit.
    return { httpStatus: 200, body: { received: true, matched: false } };
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const customerId = typeof obj.customer === "string" ? obj.customer : null;
        const subscriptionId = typeof obj.subscription === "string" ? obj.subscription : null;
        const metadata = obj.metadata as Record<string, string> | undefined;
        const plan = metadata?.plan === "GROWTH" ? "GROWTH" : "STARTER";

        await prisma.subscription.upsert({
          where: { companyId },
          update: {
            plan,
            status: "ACTIVE",
            billingProvider: "stripe",
            billingCustomerId: customerId ?? undefined,
            billingSubscriptionId: subscriptionId ?? undefined,
            currentPeriodStart: new Date(),
            cancelAtPeriodEnd: false,
            cancelledAt: null,
          },
          create: {
            companyId,
            plan,
            status: "ACTIVE",
            billingProvider: "stripe",
            billingCustomerId: customerId,
            billingSubscriptionId: subscriptionId,
            currentPeriodStart: new Date(),
          },
        });
        await prisma.auditLog.create({
          data: { companyId, userId: null, action: "SUBSCRIPTION_ACTIVATED", entityType: "Subscription", entityId: companyId, metadata: JSON.stringify({ plan }) },
        });
        await recordProcessed(companyId, event.id, event.type, `Checkout completed — plan ${plan} activated.`);
        break;
      }

      case "customer.subscription.updated": {
        const status = obj.status as string | undefined;
        const currentPeriodEnd = typeof obj.current_period_end === "number" ? new Date(obj.current_period_end * 1000) : null;
        const cancelAtPeriodEnd = !!obj.cancel_at_period_end;
        const mapped = status === "past_due" ? "PAST_DUE" : status === "canceled" ? "CANCELLED" : status === "active" ? "ACTIVE" : null;

        if (mapped) {
          await prisma.subscription.upsert({
            where: { companyId },
            update: { status: mapped, currentPeriodEnd: currentPeriodEnd ?? undefined, cancelAtPeriodEnd },
            create: { companyId, status: mapped, currentPeriodEnd, cancelAtPeriodEnd, billingProvider: "stripe" },
          });
          await prisma.auditLog.create({
            data: { companyId, userId: null, action: "PAYMENT_STATE_CHANGED", entityType: "Subscription", entityId: companyId, metadata: JSON.stringify({ status: mapped }) },
          });
        }
        await recordProcessed(companyId, event.id, event.type, `Subscription updated — status ${mapped ?? status ?? "unknown"}.`);
        break;
      }

      case "customer.subscription.deleted": {
        await prisma.subscription.upsert({
          where: { companyId },
          update: { status: "CANCELLED", cancelledAt: new Date() },
          create: { companyId, status: "CANCELLED", cancelledAt: new Date(), billingProvider: "stripe" },
        });
        await prisma.auditLog.create({
          data: { companyId, userId: null, action: "SUBSCRIPTION_CANCELLED", entityType: "Subscription", entityId: companyId },
        });
        await recordProcessed(companyId, event.id, event.type, "Subscription cancelled.");
        break;
      }

      case "invoice.payment_failed": {
        await prisma.subscription.upsert({
          where: { companyId },
          update: { status: "PAST_DUE" },
          create: { companyId, status: "PAST_DUE", billingProvider: "stripe" },
        });
        await prisma.auditLog.create({
          data: { companyId, userId: null, action: "PAYMENT_STATE_CHANGED", entityType: "Subscription", entityId: companyId, metadata: JSON.stringify({ status: "PAST_DUE" }) },
        });
        await recordProcessed(companyId, event.id, event.type, "Payment failed — marked past due.");
        break;
      }

      default:
        await recordProcessed(companyId, event.id, event.type, "Unhandled event type, no-op.");
    }

    return { httpStatus: 200, body: { received: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe webhook processing failed.";
    logger.billingFailure(message, { eventId: event.id, eventType: event.type, companyId });
    return { httpStatus: 500, body: { error: "Webhook processing failed." } };
  }
}
