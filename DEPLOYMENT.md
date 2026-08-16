# SalesLeak — Deployment

Practical guide for running SalesLeak locally, and for deploying/operating the
Vercel + Supabase staging environment. See [ARCHITECTURE.md](ARCHITECTURE.md)
for how the pieces fit together and why; this file is just the "what to run."

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
| `NODE_ENV` | Managed by the platform | Never set by hand. Next.js sets it to `production` for `next build`/`next start`, and Vercel always builds this way — this is what gates the demo-reset action and the login page's demo-account list off in every real deployment (see "Production safety" below). |
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
