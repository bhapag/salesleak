# SalesLeak — Launch Checklist

Reconciled against reality on **2026-09-09** at HEAD `3d241be`. Every line is
one of:

- **VERIFIED COMPLETE** — done, and checked against the running system or code
- **EXTERNAL VERIFICATION PENDING** — built and believed correct, but not yet
  proven against the real third party
- **HUMAN ACTION REQUIRED** — only you can do it (account, payment, decision)
- **BLOCKED** — waiting on something outside this repository
- **DEFERRED** — deliberately postponed, with a reason
- **NOT NEEDED** — considered and rejected for this stage

Nothing is marked complete unless it was actually verified. Supporting detail:
[DEPLOYMENT.md](DEPLOYMENT.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[BACKUP_RECOVERY.md](BACKUP_RECOVERY.md),
[STRIPE_ACTIVATION.md](STRIPE_ACTIVATION.md), [PROJECT_STATE.md](PROJECT_STATE.md).

## Engineering foundation

- **VERIFIED COMPLETE** — 122 automated tests covering tenant isolation, role
  permissions, session handling, ingestion and AI scoping, sensitive-field
  exposure, and export limits. Proven non-vacuous by mutation testing: removing
  a `companyId` scope fails 8 tests; widening an Owner-only permission fails 5.
- **VERIFIED COMPLETE** — GitHub Actions CI on every push: install, Prisma
  validate, lint, typecheck, tests, production build. Green on `main`.
- **VERIFIED COMPLETE** — Two real security defects found and fixed with
  regression coverage: a cross-tenant `scheduleFollowUp` assignment, and
  `passwordHash` reaching client-bound RSC payloads on eight routes.
- **VERIFIED COMPLETE** — Serverless functions co-located with the database in
  `sin1`. Measured 13× improvement: pages went from ~2.27s to ~0.17s.
- **DEFERRED** — Real-Postgres integration tests. See PROJECT_STATE.md; not a
  launch blocker.
- **DEFERRED** — Database-level RLS. App-level isolation is enforced at every
  query and covered by tests. Revisit only with new evidence.

## Infrastructure

- **VERIFIED COMPLETE** — Production deployment on Vercel, healthy, with
  `/api/health` returning `200`.
- **VERIFIED COMPLETE** — Daily Vercel Cron pings `/api/health`, registered and
  confirmed via `vercel crons ls`. Prevents free-tier inactivity pause. **Not
  backup protection.**
- **HUMAN ACTION REQUIRED** — Custom domain. Not purchased. Steps are in
  DEPLOYMENT.md. Production runs on the Vercel-assigned domain until then.
- **NOT NEEDED** — A separate production Vercel project. The current
  single-project setup is adequate at this scale.

## Data safety

- **HUMAN ACTION REQUIRED — highest priority** — Supabase is on the **free
  tier**, confirmed by the 2026-09-08 auto-pause incident. There are **no
  automatic backups**. If the database were lost today, the data would be
  gone. Upgrading to Pro (~$25/mo) enables daily backups.
- **HUMAN ACTION REQUIRED** — No restore has ever been tested. One rehearsal
  restore into a scratch database is the highest-value item in
  BACKUP_RECOVERY.md.
- **VERIFIED COMPLETE** — CSV export for customers, leads and quotations,
  Owner-only and tenant-scoped. Characterised by tests as **data portability,
  not backup** — it carries no identifiers, no tasks or line items, and cannot
  be re-imported to reconstruct a workspace.
- **VERIFIED COMPLETE** — Seed/demo data cannot run against production
  (`NODE_ENV` guard).

## Security and access

- **VERIFIED COMPLETE** — scrypt password hashing, DB-backed sessions,
  deactivated-user login blocking, tenant isolation enforced in every query,
  role gating (Owner / Sales Manager / Salesperson), last-Owner protection.
  All covered by automated tests.
- **VERIFIED COMPLETE** — No secrets reach the client; no `NEXT_PUBLIC_*` in
  the codebase; production errors expose no stack traces.
- **VERIFIED COMPLETE** — CSP, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` set in `next.config.ts`.

## Billing

- **HUMAN ACTION REQUIRED** — Stripe is not connected. Four environment
  variables are unset; the Billing page honestly shows a not-connected state.
  Full procedure: [STRIPE_ACTIVATION.md](STRIPE_ACTIVATION.md).
- **VERIFIED COMPLETE (code)** — Webhook signature verification, idempotency,
  out-of-order tolerance, status mapping, audit logging. Reviewed 2026-09-09;
  no code blocker to activation.
- **NOT NEEDED for a FOUNDING pilot** — A pilot customer is assigned via
  `scripts/assignFoundingPlan.ts`; no checkout is involved.

## Integrations

- **VERIFIED COMPLETE** — Manual entry, CSV import, and the Website Form
  connector work end-to-end.
- **BLOCKED (IndiaMART's side)** — Stays in honest Test Mode. Requires a paid
  IndiaMART seller account, then pasting the workspace webhook URL into the
  seller panel and confirming by OTP. No IndiaMART API key is ever entered
  into SalesLeak.
- **NOT NEEDED** — Justdial, ExportersIndia, TradeIndia, WhatsApp, Gmail.
  Shown as "Coming Soon", never claimed as working.

## Legal and trust

- **HUMAN ACTION REQUIRED** — `/terms` and `/privacy` exist as honest
  "not yet published" holding pages. **The real legal content does not
  exist.** This needs your decision or a lawyer's: legal entity name,
  jurisdiction, governing law, retention periods, and DPDP Act 2023 posture
  given the India-first defaults. Nothing here will be invented.
- **VERIFIED COMPLETE** — Support address `salesleak.support@gmail.com` is
  surfaced on login, signup, `/welcome`, and Company Settings.
- **HUMAN ACTION REQUIRED** — That inbox must actually be monitored before a
  real customer relies on it.
- **VERIFIED COMPLETE** — `robots.ts` (default-deny, explicit allow) and
  `sitemap.ts` covering only genuinely public pages.

## Brand

- **HUMAN ACTION REQUIRED** — Both brand PNGs are fully opaque with a baked
  navy background (`rgb(0,13,47)` / `rgb(4,17,50)`) that does not match the
  app's navy (`rgb(11,23,57)`), so a faint rectangle is visible wherever a
  logo sits on navy — most noticeably the login and signup logo at 190×95.
  Needs a re-export with a transparent background. Not fixable in code; a CSS
  blend workaround was tested and does not work.

## Monitoring

- **VERIFIED COMPLETE** — `/api/health` returns `200`/`503` correctly.
  Structured JSON logging with secret redaction across database, auth,
  webhook, ingestion, AI and billing failures, visible in Vercel logs.
- **HUMAN ACTION REQUIRED** — Nothing alerts you proactively; someone has to
  look. A free uptime monitor (UptimeRobot, Better Stack) polling
  `/api/health` closes this in minutes but needs a third-party account.

## Product validation

- **VERIFIED COMPLETE** — The full funnel has been exercised end-to-end:
  signup → trial → onboarding → lead → assignment → follow-up → quotation →
  Won, plus the Lost path with its mandatory reason.
- **HUMAN ACTION REQUIRED** — No real customer has used SalesLeak. Nothing in
  this repository can substitute for that.

---

# Launch gate

Two distinct bars. Do not conflate them.

## Pilot-ready — a controlled first customer you know

Everything here is either already true or a short human action.

| Requirement | Status |
|---|---|
| Zero known P0 defects | ✅ none open |
| Green CI on `main` | ✅ |
| Production healthy, `/api/health` 200 | ✅ |
| Core workflow verified end-to-end | ✅ |
| Desktop + mobile sanity pass (375/768/1440) | ✅ no overflow on any screen |
| Tenant isolation and permissions tested | ✅ 122 tests |
| Support channel surfaced **and monitored** | ⚠️ surfaced; monitoring is yours |
| A real backup taken before their data exists | ❌ **human action** |
| Terms and Privacy published | ❌ **human action** |
| Customer told plainly it is an early pilot | ❌ your call |

**Verdict: pilot-ready once you take one `pg_dump`, publish real legal pages,
and monitor the support inbox.** Stripe, custom domain, and IndiaMART are not
required for a FOUNDING-plan pilot.

## Paid-launch-ready — recurring payments and customers you don't know

Everything above, plus:

| Requirement | Status |
|---|---|
| Supabase Pro with automatic daily backups | ❌ human action |
| A restore actually rehearsed and timed | ❌ human action |
| Stripe live, verified per STRIPE_ACTIVATION.md §6 and §9 | ❌ human action |
| Cancellation and failed-payment paths exercised | ❌ part of the above |
| Uptime alerting that reaches you | ❌ human action |
| Custom domain | ❌ human action |
| Legal review of Terms/Privacy for paid B2B | ❌ human action |
| At least one pilot customer's feedback incorporated | ❌ requires the pilot |

**Verdict: not paid-launch-ready, and correctly so.** Every remaining item is
an account, a payment, or a decision — none is code.
