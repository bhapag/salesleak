# SalesLeak — Launch Checklist

Phase 15 launch-readiness checklist. Each item is marked **READY**,
**BLOCKED** (needs an action only you can take — an account, a payment, a
legal decision), or **OPTIONAL LATER** (a real improvement, not required to
onboard Customer #1). Nothing here is marked ready unless it was actually
verified this phase — live in the browser, by direct code review, or both.
See [DEPLOYMENT.md](DEPLOYMENT.md), [ARCHITECTURE.md](ARCHITECTURE.md), and
[BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) for the full detail behind each line.

## Infrastructure

- **READY** — Staging deployment live at `https://salesleak-theta.vercel.app`, deployed via Vercel CLI, verified working end-to-end this phase.
- **READY** — Local/staging/production environment separation documented (DEPLOYMENT.md's "Environments" section) — same codebase, different databases and credentials per environment, no code branching on "which environment."
- **BLOCKED** — Custom domain. Not purchased, not configured — see DEPLOYMENT.md's "Custom domain readiness" section for the exact steps once you own a domain. Staging continues running on the Vercel-assigned domain until then.
- **OPTIONAL LATER** — A dedicated production Vercel project distinct from staging, if you'd rather not promote the same project. Reasonable to defer until real customer volume justifies the separation; today's single-project setup with environment-scoped credentials is enough for a first pilot customer.

## Environment variables

- **READY** — `DATABASE_URL`, `DIRECT_URL`, `APP_URL` configured on the existing Vercel staging project.
- **READY (documented)** — Full variable-by-variable reference with required/optional status lives in DEPLOYMENT.md's env var table; nothing here is a guess.
- **OPTIONAL LATER** — `ANTHROPIC_API_KEY` unset; every AI surface runs in an honestly-labeled mock mode. Set it whenever you want real AI calls — no code change needed either way, and this was deliberately left unset to avoid an unrequested paid service.
- **BLOCKED (your decision)** — `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH` unset. See "Stripe / billing" below — not required to onboard a FOUNDING-plan pilot customer.

## Domain

- **BLOCKED** — See "Infrastructure" above. This is the one item this phase was explicitly told to stop and hand back to you rather than act on.

## Database

- **READY** — Schema fully migrated on the staging Postgres database (Supabase); `npx prisma migrate deploy` is the documented, safe, forward-only path for future schema changes.
- **READY** — Demo/seed data is isolated to two clearly-fictional companies and cannot run against a production database (hard `NODE_ENV=production` guard, independent of who runs the command).
- **OPTIONAL LATER (real recommendation)** — Automatic daily backups. The Supabase project's current plan (verify in the Supabase dashboard's Billing page) very likely does not include them — Supabase's free tier ships with **no automatic backups at all**. `BACKUP_RECOVERY.md` documents a manual `pg_dump` workaround that works today on any plan, but before real, non-test customer data accumulates, upgrading the production Supabase project to at least **Pro** (~$25/mo, includes 7-day daily backups) is a genuine, worthwhile recommendation — not something done automatically here since it costs money.

## Authentication

- **READY** — Hashed passwords (scrypt-based), DB-backed sessions, disabled-user login blocking (confirmed by direct code read of `getSession()`), tenant isolation verified live this phase via three separate direct-URL cross-company access attempts (lead/quotation/customer), all correctly blocked with generic "not found" responses (no existence leak).
- **READY** — Role-based access re-verified live this phase: a Salesperson blocked from `/team` (server-side "Not authorized", not just a hidden nav link), a Sales Manager correctly retaining full team visibility, Owner-only pages (Billing, Company Settings, Pilot Readiness) all gated.

## Integrations

- **READY** — CSV import, manual entry, and Website Form connector are genuinely live and were exercised live this phase end-to-end (a real signup's manually-entered lead went all the way to Won).
- **BLOCKED (your action, on IndiaMART's side)** — IndiaMART stays in honest **Test Mode**. To go live: you need an active **paid** IndiaMART seller account (the Push API is an add-on, not sold standalone), then in the seller panel (seller.indiamart.com → Lead Manager → Import/Export Leads → Push API) paste this workspace's webhook URL (shown on `/settings/integrations`, unique per company) as the "Integration URL" and confirm via the OTP sent to the account's registered mobile number. No IndiaMART-issued API key is ever entered into SalesLeak — the webhook URL's own random token is the only credential, and it's already generated. After the first real enquiry arrives, verify it lands correctly in the Failed Ingestion Queue or as a real lead, and correct field mapping there if IndiaMART's actual payload differs from what the adapter assumes.
- **OPTIONAL LATER** — Justdial, ExportersIndia, TradeIndia, WhatsApp, Gmail. Deliberately out of scope per every phase's instructions; shown as "Coming Soon," never claimed as working.

## Stripe / billing

- **BLOCKED (your action)** — No live Stripe account connected; Billing page honestly shows a "not connected" test/dev mode rather than faking payment. **Not required to onboard Customer #1** if they're a FOUNDING-plan pilot customer (assigned directly, no checkout involved). Needed only once you want a self-serve Starter/Growth customer to pay through the app. Exact checklist:
  1. Create a Stripe account; use **test mode** keys first.
  2. Developers → API keys → copy the **Secret key** → `STRIPE_SECRET_KEY`.
  3. Create two Products (Starter, Growth), each with one recurring monthly Price → `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH`.
  4. Register a webhook endpoint at `/api/webhooks/stripe` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` → copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
  5. Add all four as Vercel environment variables, redeploy, and verify a test-mode checkout succeeds end-to-end **before** switching to live keys. Live Stripe usage costs standard per-transaction processing fees.
- **READY (architecture)** — Provider abstraction, webhook signature verification (manual HMAC, constant-time comparison, replay tolerance), idempotent event processing, and audit logging of every billing event are all built and were code-reviewed again this phase; they activate automatically the moment real keys are added, no code change required.

## Security

- **READY** — Full final-pass this phase covered: cross-company data isolation (live-tested), role-based page/action gating (live-tested), Stripe subscription state proven server-side-only and unforgeable client-side (code review — no server action accepts client-supplied plan/status), webhook signature verification (code review, unchanged since Phase 8/13), integration secrets never reaching the client (zero `NEXT_PUBLIC_*` vars in the entire codebase), AI calls tenant-scoped (unchanged since Phase 9), CSV export scoped to the exporter's own company only (re-confirmed by code read), disabled-user login blocking (code-confirmed), and production error responses never including stack traces or internal messages (code-confirmed, `error.tsx` renders only a generic message + digest).
- **Two real issues found and fixed this phase** (not just confirmed-clean — see ARCHITECTURE.md for detail):
  1. The local-dev-only login page's "demo accounts" panel was querying *every* company in the database rather than the two genuinely-seeded fictional ones, so a company created through real `/signup` testing (this phase's "Vasant Industrial Fasteners," and an earlier phase's "Staging Test Industries") was incorrectly listed with a false shared-password claim. Fixed to a fixed allowlist of the two actual seed companies. Dev-only, never reachable in staging/production (gated by `NODE_ENV`), but was misleading and is fixed.
  2. The Dashboard's home page showed every logged-in user — including Salespeople — company-wide figures and a named-peer performance table ("Team Snapshot": each teammate's individual won-value and open-quotation figures), even though the dedicated `/team` page explicitly blocks Salespeople from that same data. Fixed: the Dashboard now scopes to the caller's own records for Salespeople (matching every other list page in the app) and hides the Team Snapshot section entirely for that role, consistent with `/team`'s own access rule.

## First customer

- **READY (procedurally)** — The complete funnel was run live this phase end-to-end on a brand-new real company created through actual `/signup`: signup → 14-day trial starts → 7-step onboarding wizard (company details, add teammate, workflow defaults, lead sources, follow-up defaults, "add leads manually") → landed on a clean `/leads` with correct trial banner → manual lead created → assigned to the new teammate → marked contacted → follow-up scheduled → quotation created and sent → moved to Negotiating → marked Won (with the optional lead-sync checkbox exercised) → customer correctly bucketed "Active Customer" → dashboard reflected the new Won Value. A second lead was also run through the Lost path, confirming the mandatory lost-reason requirement is actually enforced (a bare "Confirm Lost" click with no reason selected was correctly rejected). No developer or placeholder language appeared anywhere in this real flow.
- **BLOCKED (your decision, only if relevant)** — If Customer #1 is a FOUNDING-plan pilot: run `npx tsx scripts/assignFoundingPlan.ts <their-owner-email>` after they've signed up (see DEPLOYMENT.md's "Assigning a real customer to the FOUNDING plan" section for the exact command and why it's the production-safe method — never the Billing page's dev-only button).
- **BLOCKED (your action)** — IndiaMART and/or Stripe, only if Customer #1 needs either — see those sections above.

## Support

- **BLOCKED (your action)** — There is currently no support contact surfaced anywhere in the product (no support email, no contact link, no in-app help). This isn't something to build automatically — before onboarding a real customer, decide on and add at least one real channel they can reach you through (a monitored email address is enough at pilot scale) so this checklist isn't misleading about what "launched" means.

## Backups

- **READY** — `BACKUP_RECOVERY.md` written this phase: manual `pg_dump`/`pg_restore` procedure (works today, any Supabase plan), a disaster-recovery checklist, and a clear explanation of what backups are/aren't for (whole-database disaster recovery, not undoing a single mis-click — that's what the existing audit log and activity timelines are for).
- **OPTIONAL LATER (real recommendation)** — See "Database" above: upgrading to Supabase Pro for automatic daily backups before real customer data accumulates.

## Legal / basic policies

- **BLOCKED (your decision — not something built here)** — No Terms of Service, Privacy Policy, or Cookie/consent notice exists anywhere in the product. This is a genuine gap for a real commercial launch, especially collecting business contact data (customer names, phone numbers, emails) under Indian jurisdiction (the product defaults to `Asia/Kolkata`/INR), which is plausibly in scope of India's DPDP Act 2023 depending on how you operate. Drafting binding legal text isn't something to generate speculatively — it needs your own review (or a lawyer's) before it's real. Flagging its absence honestly here rather than pretending a placeholder document would count.

## Post-launch monitoring

- **READY** — `/api/health` reachable and verified (returns `200`/`ok` when the database is reachable, `503` otherwise); structured logs cover database, auth, webhook, ingestion, AI, and billing failures (`src/lib/logger.ts`), all viewable in the Vercel dashboard's Logs tab.
- **OPTIONAL LATER (recommended, low cost)** — Nothing currently pushes an alert to you proactively; someone has to look. A free external uptime monitor (UptimeRobot or Better Stack, both have workable free tiers) polling `/api/health` closes this gap in a few minutes once you're ready — see DEPLOYMENT.md's "Observability" section for specifics. Not set up automatically since it requires a third-party account.

## Summary

Everything inside this codebase's control — the product itself, its security
posture, its data-safety story, and its documentation — is **READY**. What
remains before Customer #1 is genuinely onboarded is a short list of actions
only you can take: a support channel, a decision on legal policies, and
(only if that customer needs them) IndiaMART's seller-side webhook
configuration or a live Stripe account. None of these require more code.
