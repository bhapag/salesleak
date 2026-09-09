# SalesLeak — Stripe Activation Runbook

A practical 15–30 minute procedure for turning on real billing. Every step
below was derived from the actual code in `src/server/billing/`, not from
Stripe's generic docs.

**Nothing in this repository activates Stripe.** No live keys exist, no
payment has been taken, and the Billing page honestly shows a not-connected
state until the variables below are set.

## Code-readiness verdict

The billing implementation is ready. Reviewed again on 2026-09-09:

- Webhook signature verified before any work, over the **raw** request body
  (the route reads `request.text()` and never JSON-parses first, which would
  break verification).
- HMAC comparison is constant-time, with replay tolerance.
- **Idempotent**: each processed Stripe `event.id` is recorded as an
  `AuditLog` row (`entityType: "StripeEvent"`), and a repeat delivery
  short-circuits to `200 {duplicate: true}`.
- **Order-independent**: every subscription write is an `upsert`, because
  Stripe does not guarantee delivery order.
- Events that cannot be matched to a company return **200**, so Stripe stops
  retrying something unactionable. Genuine processing errors return **500**,
  so Stripe does retry.
- Subscription state is server-derived only. No server action accepts a
  client-supplied plan or status.
- Every billing event is audit-logged.

There is **no remaining code blocker**. Activation is configuration.

## 1. Stripe objects and settings that must exist

| Object | Requirement |
|---|---|
| Account | Any Stripe account. Start in **test mode**. |
| Product ×2 | One for Starter, one for Growth. |
| Price ×2 | One **recurring monthly** price per product. Copy each `price_…` id. |
| Webhook endpoint | Pointing at your deployment (step 3). |
| Customer portal | Enable in Settings → Billing → Customer portal. The app calls the portal API for subscription management. |

The `FOUNDING` plan is internal — it is assigned by script, never sold through
Stripe. Do not create a Stripe product for it.

## 2. Environment variables

All four go in **Vercel → Project → Settings → Environment Variables →
Production**, then redeploy.

| Variable | Where it comes from | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Developers → API keys → Secret key | **This one variable gates everything** — `isConfigured()` is `!!STRIPE_SECRET_KEY`. Until it is set, checkout returns "Billing isn't connected in this environment yet." |
| `STRIPE_WEBHOOK_SECRET` | The signing secret of the endpoint from step 3 | Endpoint-specific. Test and live endpoints have different secrets. |
| `STRIPE_PRICE_STARTER` | The Starter recurring price id | `price_…`, not the product id. |
| `STRIPE_PRICE_GROWTH` | The Growth recurring price id | `price_…`, not the product id. |

Also confirm **`APP_URL`** is set to the real production origin. Checkout
success, cancel, and portal-return URLs are all built from it
(`getAppBaseUrl()`), so a wrong value sends paying customers to the wrong host.

## 3. Webhook endpoint

- **URL:** `https://<your-domain>/api/webhooks/stripe`
- **Method:** POST only (GET returns 405 by design)
- **Events to subscribe — exactly these four are handled:**
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Any other event type is accepted, recorded as a no-op, and ignored. Subscribing
to more is harmless but pointless.

After creating the endpoint, copy its **signing secret** into
`STRIPE_WEBHOOK_SECRET` and redeploy. The secret is per-endpoint: creating a
live endpoint later means a new secret and another redeploy.

## 4. Application config that must match Stripe

- `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH` must be **recurring** prices.
  The checkout session is created with `mode: "subscription"`; a one-time price
  will fail.
- Stripe subscription statuses map as: `active` → `ACTIVE`, `past_due` →
  `PAST_DUE`, `canceled` → `CANCELLED`. Anything else is recorded but leaves
  status unchanged.
- The plan comes from checkout `metadata.plan`; anything other than `GROWTH`
  is treated as `STARTER`. The app sets this itself — do not override it in
  the Stripe dashboard.
- Company identity travels as both `client_reference_id` and
  `metadata.companyId` on the checkout session. Later events carry only the
  Stripe customer id and are matched via the stored `billingCustomerId`, which
  is why the **first** successful checkout must complete for a company before
  its later events can resolve.

## 5. Activation sequence

1. Create products and prices in **test mode**.
2. Set all four variables (test values) plus `APP_URL` in Vercel Production,
   and redeploy.
3. Create the test-mode webhook endpoint; set `STRIPE_WEBHOOK_SECRET`;
   redeploy.
4. Run the first-transaction verification below **in test mode**.
5. Only once that passes end-to-end: switch to **live mode**, create live
   products/prices and a live webhook endpoint, replace all four variables
   with live values, and redeploy.
6. Re-run the verification with one real card, then refund it.

Do not skip step 4. Live keys make every mistake cost real money.

## 6. First live transaction — verification

As an Owner on a workspace that is not already subscribed:

1. Go to `/settings/billing`, choose a plan, complete Stripe Checkout.
2. You should land on `/settings/billing?checkout=success`.
3. **In the app:** the workspace shows as active on that plan, and the
   read-only banner (if the trial had lapsed) is gone.
4. **In Stripe:** Developers → Events → `checkout.session.completed` shows a
   `200` response from your endpoint.
5. **In the database:** the company's `Subscription` row has `status ACTIVE`,
   the right `plan`, and non-null `billingCustomerId` and
   `billingSubscriptionId`.
6. **Audit trail:** an `AuditLog` row with action `SUBSCRIPTION_ACTIVATED`,
   plus one with `SUBSCRIPTION_WEBHOOK_PROCESSED` and
   `entityType: "StripeEvent"`.
7. Open the customer portal from Billing and confirm it loads and returns you
   to `/settings/billing`.

If steps 1–2 work but 3–6 do not, the checkout succeeded and the **webhook**
is the problem — go to step 8.

## 7. Rollback and failure checks

| Symptom | Cause | Action |
|---|---|---|
| "Billing isn't connected in this environment yet." | `STRIPE_SECRET_KEY` unset or redeploy not done | Set it, redeploy |
| Stripe shows `400` on the event | Signature mismatch — wrong or stale `STRIPE_WEBHOOK_SECRET` | Copy the secret from that exact endpoint, redeploy |
| Stripe shows `200 {matched: false}` | Event could not be tied to a company | Expected for events from before the first checkout; otherwise check `billingCustomerId` on the Subscription row |
| Stripe shows `500` | Processing threw | Check Vercel logs for `category: "billing"`; Stripe will retry automatically |
| Checkout succeeds, app unchanged | Webhook not delivering | Re-check URL, events, and secret |

**To roll back activation:** remove the four variables and redeploy. The app
returns to the not-connected state. Existing `Subscription` rows keep whatever
status they last had — clearing keys does not downgrade anyone.

## 8. Never change these by hand in the database

- `Subscription.status`, `plan`, `billingCustomerId`, `billingSubscriptionId`
  — webhooks `upsert` these, so manual edits are silently overwritten, and a
  wrong `billingCustomerId` permanently orphans that company's future events.
- `AuditLog` rows with `entityType: "StripeEvent"` — this is the idempotency
  ledger. Deleting one lets that event reprocess.

For a FOUNDING-plan pilot customer, use
`npx tsx scripts/assignFoundingPlan.ts <owner-email>`, not a manual database
edit and not the Billing page's dev-only control.

## 9. What counts as successful activation

All of the following, in test mode first and then live:

- A checkout completes and the workspace becomes `ACTIVE` on the right plan
  without anyone touching the database.
- Stripe's Events list shows `200` for the four handled event types.
- A duplicate delivery returns `{duplicate: true}` rather than double-writing.
- A cancellation in the portal flips the workspace to `CANCELLED`, and the
  read-only banner and gated creation controls reappear.
- A failed payment (Stripe's test card `4000 0000 0000 0341`) flips the
  workspace to `PAST_DUE`.
- Every one of those transitions has a matching `AuditLog` row.

Until the cancellation and failed-payment cases have both been exercised at
least once, treat billing as activated but unproven.
