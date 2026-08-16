# SalesLeak — Deployment

Practical guide for running SalesLeak locally, and for deploying/operating the
Vercel + Supabase staging environment. See [ARCHITECTURE.md](ARCHITECTURE.md)
for how the pieces fit together and why; this file is just the "what to run."

## Environments (Phase 15)

SalesLeak recognizes three distinct environments. They are kept separate by
using **entirely separate databases and separate credential sets** — there is
no shared state between them, and nothing here automatically promotes data
or config from one to the next.

| | Local development | Staging (current) | Production (future) |
|---|---|---|---|
| Purpose | Day-to-day coding on this machine | Living demo + pre-launch verification; where Phase 11–15 testing has happened | Real pilot/paying customers |
| Vercel project | n/a (`npm run dev`) | existing project behind `salesleak-theta.vercel.app` | either the same Vercel project promoted to a custom domain, or a second Vercel project — see "Custom domain readiness" below |
| Database | Your own Supabase project (or local Postgres) — never shared with staging/production | Dedicated Supabase project, currently holding only fictional seed companies + this phase's test companies | A **separate** Supabase project, holding real customer data only |
| `NODE_ENV` | `development` (Next.js default for `next dev`) | `production` (Vercel always builds this way — see note below) | `production` |
| Seed data (`npx prisma db seed`) | Yes, freely | Yes — this is how the two fictional demo companies got there; safe because the DB holds no real customer data | **Never.** The seed script refuses to run when `NODE_ENV=production`, but the deeper guarantee is that a production database must never be the target of `db seed` in the first place — see "Data safety" below |
| Demo reset tool | Enabled | Enabled (dev-only UI gate uses `NODE_ENV`, which is `production` on Vercel too — see note) | Disabled by the same gate |
| Stripe | unset (test/dev mode) | unset (test/dev mode) — see "Billing / Stripe setup" | Stripe test-mode keys first, then live keys once verified — see that section |
| `APP_URL` | unset (not needed) | `https://salesleak-theta.vercel.app` | the eventual production domain, once assigned — see "Custom domain readiness" |

**Important nuance on `NODE_ENV`:** Next.js/Vercel set `NODE_ENV=production`
for *every* `next build`, including this staging deployment — there is no
"staging" value Next.js understands natively. That means a handful of
switches that key off `NODE_ENV === "production"` (the demo-reset action,
the `/login` demo-account list, the Billing page's dev-only "Assign Founding
plan" button, stack-trace suppression) are **already behaving as they would
in real production** on today's staging deployment. This has been
intentional since Phase 11: it means staging is a faithful rehearsal of
production's safety gates, not a looser environment that could mask a bug
those gates should have caught. The actual difference between "staging" and
"production" in this project is **which database and which domain a
deployment points at**, not a different code path.

## Local development

```bash
npm install                 # also runs `prisma generate` (postinstall)
npx prisma migrate dev      # apply migrations to your local DATABASE_URL
npx prisma db seed          # fictional demo data — refuses to run if NODE_ENV=production
npm run dev                 # http://localhost:3000
```

You need a real PostgreSQL database even for local dev — SalesLeak has no
SQLite/embedded-DB fallback (Phase 11 migrated fully to Postgres). The
simplest option is a free Supabase project (see below); a local `postgres`
via Docker works too, in which case `DATABASE_URL` and `DIRECT_URL` can be
the same connection string.

## Environment variables

Copy `.env.example` to `.env` and fill in real values. Full reference:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection the **running app** uses. On Supabase, use the **pooled** connection string (port `6543`, `?pgbouncer=true`) — safe for many concurrent short-lived serverless connections. |
| `DIRECT_URL` | Recommended | Postgres connection the **Prisma CLI** uses for `migrate`/`db seed` (`prisma.config.ts`). On Supabase, use the **direct** connection string (port `5432`) — pgbouncer's transaction-pooling mode can't run the prepared statements migrations need. Falls back to `DATABASE_URL` if unset (fine for a plain non-pooled local Postgres). |
| `APP_URL` | Recommended in staging/production | Public base URL of the deployment, no trailing slash. Used by `src/lib/appUrl.ts` for any future server-rendered absolute link. The webhook-URL "Copy" button on `/settings/integrations` doesn't need this — it derives from `window.location.origin` in the browser, correct in any environment automatically. |
| `ANTHROPIC_API_KEY` | No | Unset → every AI surface runs in clearly-labeled mock/dev mode (fully supported, not degraded). Set to activate real Anthropic calls, no code change needed either way. |
| `AI_MODEL` | No | Defaults to `claude-sonnet-5`. Unused if `ANTHROPIC_API_KEY` is unset. |
| `AI_INGESTION_ENRICHMENT` | No | Defaults off. See ARCHITECTURE.md's AI section. |
| `STRIPE_SECRET_KEY` | No | Unset → billing runs in honest test/dev mode (Billing page shows plans, upgrade buttons are disabled with a clear "not connected" message, nothing is charged, no fake payment is simulated). Set to activate real Stripe checkout/portal calls — see ARCHITECTURE.md's Billing section for exactly which Stripe account/keys this needs and where to get them. |
| `STRIPE_WEBHOOK_SECRET` | No (required alongside `STRIPE_SECRET_KEY` for a real integration) | Signing secret for `/api/webhooks/stripe`, from the Stripe Dashboard's endpoint configuration. Without it, that route safely 400s every request rather than skipping verification. |
| `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH` | No | Stripe Price ids (`price_...`) for the two self-serve plans, created in the Stripe Dashboard. Checkout for a plan with no configured price id fails cleanly with an inline error rather than creating a session Stripe would reject. |
| `NODE_ENV` | Managed by the platform | Never set by hand. Next.js sets it to `production` for `next build`/`next start`, and Vercel always builds this way — this is what gates the demo-reset action, the login page's demo-account list, and the Billing page's dev-only "Assign Founding plan" button off in every real deployment (see "Production safety" below). |
| `VERCEL_URL` | Managed by Vercel | Auto-set to the deployment's own hostname; used as a fallback by `getAppBaseUrl()` if `APP_URL` isn't set. |

**Never expose secrets via `NEXT_PUBLIC_*`.** SalesLeak currently has zero
`NEXT_PUBLIC_*` variables — all data access is server-side (Server
Components, Server Actions, the one webhook route), so there's nothing that
needs to reach the client bundle. Keep it that way; if a future feature
seems to need a client-side key, it almost certainly means that call should
move server-side instead.

## PostgreSQL setup (Supabase)

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. **Project Settings → Database → Connection string** — copy both:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`
   - **Direct connection** (port `5432`) → `DIRECT_URL`
3. Put both in `.env` (local) or your deployment's environment variables (staging/production) — never commit either.

Why two URLs: see the comment block at the top of `prisma.config.ts` and
`prisma/schema.prisma`'s datasource block — the installed Prisma 7.9.1 CLI
config only supports a single `url`, so the pooled-vs-direct split is done
by hand rather than via the (not-yet-implemented-in-this-version)
`directUrl` config field.

## Prisma migrations

```bash
npx prisma migrate dev --name <description>   # local: create + apply a migration
npx prisma migrate deploy                       # staging/production: apply pending migrations only
npx prisma generate                              # regenerate the client (also runs automatically via postinstall)
```

`migrate deploy` never generates new migration files and never touches
seed/demo data — it only applies whatever's already committed in
`prisma/migrations/`. This is the only command that should ever run against
a database holding real (non-fictional) data. Do not run `migrate dev`
against a shared/staging/production database — it can prompt for
destructive resets in ways appropriate for a local throwaway database but
not a shared one.

## Seed rules (read before running anything against a real database)

- `prisma/seed.ts` seeds **two entirely fictional demo companies** with
  fake accounts and a shared known password (`password123`, shown on
  `/login` only when `NODE_ENV !== "production"`). It **refuses to run**
  if `NODE_ENV=production` (hard-coded check at the top of the file) —
  this is a second, independent guard beyond just "don't run the command."
- **Never run the seed against a database holding real company data.**
  There is no merge/dedupe logic — it wipes and recreates its own tables'
  demo rows.
- Development/demo seeding (`npx prisma db seed`) and production schema
  migration (`npx prisma migrate deploy`) are deliberately separate
  commands with no shared code path, so a deploy pipeline that only ever
  runs `migrate deploy` can never accidentally seed anything.

## Vercel deployment

This project deploys with the Vercel CLI directly from the local
filesystem — no GitHub connection required (`vercel link` creates a
project from the current directory; `vercel deploy --prod` builds and
promotes to the project's stable `<name>.vercel.app` domain).

```bash
npx vercel login                       # one-time device-code auth
npx vercel link --yes --project <name> # first time only, creates the project
npx vercel env add DATABASE_URL production --value "<pooled-url>" --sensitive --yes
npx vercel env add DIRECT_URL production --value "<direct-url>" --sensitive --yes
npx vercel env add APP_URL production --value "https://<name>.vercel.app" --yes
npx vercel deploy --prod
```

After the first deploy, note the actual assigned domain in the deploy
output (Vercel may append a suffix if the exact name is taken) and update
the `APP_URL` env var to match if it differs from your guess, then redeploy.

**`.vercelignore` matters.** Vercel's CLI does not reliably respect
`.gitignore` for `.env` files during `vercel deploy` — it will upload the
local `.env` (with real secrets in it) and only print a warning
("Detected .env file, it is strongly recommended to use Vercel's env
handling instead") rather than refusing. `.vercelignore` in this repo
explicitly excludes `.env`/`.env.local`/`.env.*.local` from every upload —
if that file is ever removed, deployments will silently start shipping
local secrets again. Environment variables always come from `vercel env
add` / the Vercel dashboard, never from an uploaded file.

**Run migrations separately from the app deploy.** Vercel's build step
does not run `prisma migrate deploy` automatically — only `prisma
generate` (via the `postinstall` script). Run `npx prisma migrate deploy`
yourself (with `DIRECT_URL` pointed at the target database) before or
after deploying app code that depends on a schema change, same as any
other migration-based deployment.

## Custom domain readiness (Phase 15 — STOP, action required from you)

SalesLeak's code has no hard dependency on `salesleak-theta.vercel.app` — the
webhook URLs shown on `/settings/integrations` are derived from
`window.location.origin` in the browser (see "Webhook URL configuration"
below), so they already display correctly on any domain with zero code
changes. Moving to a real custom domain is entirely an account/DNS action,
not a development one. This is intentionally **not done yet** — staging stays
on the Vercel-assigned domain until you decide to proceed. When you're ready:

1. **Buy/own the domain yourself** (this project will not purchase one).
   Any registrar works; Vercel does not need to be the registrar.
2. **Tell me the exact domain** you want (e.g. `app.yourcompany.com` or
   `yourcompany.com`) and I'll run `npx vercel domains add <domain>` against
   the existing Vercel project — this generates the exact DNS records Vercel
   needs (typically a single `CNAME` record pointed at `cname.vercel-dns.com`
   for a subdomain, or an `A` record for an apex domain).
3. **DNS records go wherever your domain's nameservers currently point** —
   there's no requirement to move DNS management to Cloudflare or anywhere
   else. If you already use Cloudflare for this domain, add the same record
   there (with Cloudflare's proxy/orange-cloud turned **off** initially, so
   Vercel can issue its TLS certificate — it can be turned back on
   afterward). If you don't already use Cloudflare, there's no reason to add
   it just for this.
4. Once DNS propagates and Vercel shows the domain as verified, `APP_URL`
   changes from `https://salesleak-theta.vercel.app` to the new domain — I'll
   update the Vercel environment variable and redeploy.
5. **Webhook URLs update automatically** — IndiaMART's Push API URL and the
   website-form embed both derive from the browser's current origin (see
   below), so switching domains doesn't break anything already configured;
   but if IndiaMART is already live at that point, you'll need to re-paste
   the new webhook URL into IndiaMART's seller dashboard, since IndiaMART
   itself has no way to know the domain changed.
6. If Stripe is live by then, its webhook endpoint (`/api/webhooks/stripe`)
   is registered against a specific URL in the Stripe dashboard — that
   registration needs updating to the new domain too, same reasoning.

Until you complete steps 1–2, staging keeps running on
`salesleak-theta.vercel.app` — nothing here blocks continued use or testing.

## Rollback considerations

- **App code**: `vercel deploy --prod` creates a new immutable deployment
  and re-points the production alias at it; the previous deployment still
  exists and can be re-promoted with `vercel promote <previous-deployment-url>`
  or by re-running `vercel deploy --prod` from the earlier commit.
- **Database schema**: Prisma migrations are forward-only by default —
  there is no `migrate rollback` command. Rolling back a bad migration
  means writing a new migration that reverses it (or restoring from a
  Supabase point-in-time backup on paid tiers). Keep migrations small and
  additive where possible so a bad one is cheap to reverse by hand.
- **Never** roll back app code to a version whose Prisma schema doesn't
  match what's actually in the database — mismatched client/schema is the
  single most common cause of runtime errors after a rollback.

## Webhook URL configuration

Webhook URLs (shown on `/settings/integrations`, used for IndiaMART/website-
form connectors) are built client-side from `window.location.origin` — they
are correct automatically on `localhost`, the Vercel staging URL, or any
future custom domain, with no configuration needed. `APP_URL` exists for
future server-side link generation (see the env var table above) but
doesn't currently gate anything webhook-related.

## AI provider configuration

Unset `ANTHROPIC_API_KEY` (the default for this staging deployment) means
every AI surface runs in mock/dev mode — clearly labeled "Dev Mode" in the
UI, deterministic output derived from real data, never pretending to be a
real model response. To activate real calls: set `ANTHROPIC_API_KEY` (and
optionally `AI_MODEL`) as a Vercel environment variable and redeploy — no
code change required either way. Real AI calls cost money per the
Anthropic API's usual pricing; this was deliberately left unset for the
staging deployment per the "no unnecessary paid services" instruction.

## Billing / Stripe setup (Phase 14)

Unset `STRIPE_SECRET_KEY` (the default for this staging deployment) means
Billing runs in an honest test/dev mode: the plan comparison and current
subscription status are fully real and functional, but "Upgrade" buttons are
disabled with a plain "billing isn't connected in this environment yet"
message, and the Stripe webhook route safely rejects everything with a 400
rather than skipping signature verification. Nothing is charged and no fake
checkout/payment is ever simulated — this was deliberately left unset for
the staging deployment, same reasoning as the AI provider above.

To activate real billing:

1. Create (or use an existing) Stripe account. Use **test mode** keys first
   — this whole flow works identically in test and live mode, the only
   difference is which keys are configured.
2. **Developers → API keys**: copy the **Secret key** (`sk_test_...` or
   `sk_live_...`) → `STRIPE_SECRET_KEY`. Never the publishable key — this
   app has no client-side Stripe code at all, only server-side REST calls.
3. **Product catalog**: create two Products (Starter, Growth) each with one
   recurring monthly Price. Copy each Price id (`price_...`) →
   `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH`. Keep these in sync with
   `src/lib/plans.ts`'s displayed pricing by hand — nothing auto-syncs them.
4. **Webhooks**: register an endpoint at
   `https://<your-domain>/api/webhooks/stripe`, subscribed to at least
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, and `invoice.payment_failed`. Copy the
   endpoint's **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.
5. Add all four as Vercel environment variables and redeploy — no code
   change required either way, same pattern as the AI provider.

Real Stripe usage costs money once out of test mode (Stripe's standard
processing fees per transaction; no separate SaaS fee for using the API).
The FOUNDING plan is never sold through Checkout — it's assigned directly,
either via `scripts/assignFoundingPlan.ts` (the real, production-safe method
for an actual pilot customer — run with database credentials, no web-
reachable path) or the Billing page's "Assign Founding plan (dev only)"
button, which is hard-gated off whenever `NODE_ENV=production`.

## Assigning a real customer to the FOUNDING plan (Phase 15)

The exact process for onboarding one of the first pilot customers onto the
FOUNDING plan, once their company has signed up and completed onboarding:

```bash
# From a machine with the target database's DATABASE_URL in its .env
# (i.e. run this the same way you'd run a migration — local checkout,
# real credentials, no web-reachable path):
npx tsx scripts/assignFoundingPlan.ts owner@theircompany.com
# or, if you already know their company id:
npx tsx scripts/assignFoundingPlan.ts <companyId>
```

This upserts their `Subscription` to `plan: FOUNDING, status: ACTIVE` and
writes a `PLAN_CHANGED` audit log entry (`metadata.via: "operator_script"`)
so there's a permanent record of who/when/how. It does **not** touch
anything else about their account or data.

Do not use the Billing page's "Assign Founding plan (dev only)" button for a
real customer even in staging — that path exists only for developer testing
and is hard-gated off in production specifically so it can never be reached
outside a non-production build; the script above is the one real mechanism
and works identically regardless of environment.

## Observability (Phase 15)

**What's already in place** — every category of failure the phase asked to
be diagnosable already has a dedicated, structured path (see
`src/lib/logger.ts`, whose categories are `auth`, `database`, `ingestion`,
`webhook`, `ai`, `billing`, `server`):

| Failure | How to see it |
|---|---|
| Database outage | `GET /api/health` returns `503` immediately; a `database` log line is written with the underlying error message (no connection string/secrets) |
| Auth failure | `auth` log line on every failed login attempt, with the reason (`no_such_user` / `inactive_user` / `bad_password`) but never the password itself |
| Webhook ingestion failure | `webhook` log line (rate limit, unrecognized token, bad signature) plus, for payloads that parse but can't become a valid lead, a row in the **Failed Ingestion Queue** visible on `/settings/integrations` (Owner/Sales Manager) |
| Failed ingestion | Same Failed Ingestion Queue — every failure is a persisted, inspectable, retryable/dismissable row, never a silently dropped request |
| AI provider failure | `ai` log line; the calling feature falls back to its honest "AI unavailable" state rather than fabricating a response |
| Stripe webhook failure | `billing` log line (signature failure, unmatched event, processing error); unsigned/misconfigured requests get a safe `400` rather than being processed unverified |

All log lines are plain JSON to stdout/stderr, which Vercel captures
automatically and makes searchable/filterable in the Vercel dashboard's
**Logs** tab (or `vercel logs`) — no separate log shipping needed at this
scale. `REDACT_KEYS` in `logger.ts` strips any field literally named
`password`, `token`, `secret`, `apiKey`, etc. regardless of caller, as a
defensive backstop on top of callers already only passing whitelisted fields
(ids, provider names, error message strings — never raw payloads or PII
beyond what's operationally necessary).

**What's not in place, and a low-cost recommendation:** none of the above is
proactively *pushed* to you — someone has to look at `/api/health` or the
Vercel logs. For a small pilot-stage product, a free external uptime monitor
polling `/api/health` and alerting by email/Slack when it goes red is enough
to close that gap without adding real infrastructure:

- **UptimeRobot** free plan — 50 monitors, 5-minute interval, email/SMS
  alerts, no card required. Its own pricing page frames the free plan as
  intended for "hobby and non-profit projects," so worth re-checking their
  current terms once SalesLeak has paying customers, but it's a fine way to
  start.
- **Better Stack** free plan — 10 monitors, ~3-minute interval, Slack/email
  alerts — a reasonable alternative with similar caveats about commercial use
  at scale.

Either just needs `https://<your-domain>/api/health` added as an HTTP
monitor expecting a `200`. This is **not set up automatically** — it
requires creating a third-party account, which is your decision (and
possibly eventually your subscription) to make, not something done on your
behalf here.

## Common deployment failures

- **Build fails with a Prisma "environment variable not found" error** —
  `DATABASE_URL` isn't set on the target environment in the Vercel
  dashboard/CLI. Check `vercel env ls`.
- **`next build` succeeds locally but the deployed app 500s on every
  page** — usually means `DATABASE_URL` is set but wrong (bad password,
  wrong host, or a direct-connection URL used where the pooled one is
  needed under load). Check `/api/health` first — it isolates "can the app
  reach Postgres at all" from everything else.
- **Migrations "succeed" locally but the deployed app is missing a
  table/column** — `migrate deploy` was never run against the target
  database, only `migrate dev` locally. These are two separate steps in
  this project's pipeline; deploying app code does not apply schema
  changes by itself.
- **A local `.env` full of real secrets shows up in a Vercel deployment's
  build log** — `.vercelignore` is missing or was edited to no longer
  exclude `.env`. See the Vercel deployment section above.
- **Prisma client errors immediately after adding a new model/field** —
  `prisma generate` didn't rerun. It's wired to `postinstall`, so a fresh
  `npm install` (which Vercel always does) fixes it; locally, run
  `npx prisma generate` by hand after any schema.prisma edit if you didn't
  run a fresh install.
- **Seed command does nothing / errors "Refusing to run the demo seed
  against a production database"** — `NODE_ENV=production` was set when
  running `npx prisma db seed`. This is intentional (see Seed rules
  above) — never override it to force a seed run against a real database.
