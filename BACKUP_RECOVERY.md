# SalesLeak — Backup & Recovery

Practical guide for protecting and recovering SalesLeak's data. This is
deliberately lightweight — SalesLeak runs on a single managed Postgres
database (Supabase) with no other stateful infrastructure, so there is one
thing to back up and one thing to restore. See [DEPLOYMENT.md](DEPLOYMENT.md)
for how the database connects to the app, and [ARCHITECTURE.md](ARCHITECTURE.md)
for the schema itself.

## What's actually at risk

Everything SalesLeak stores lives in one Postgres database: companies, users,
leads, quotations, customers, tasks, notifications, integrations,
subscriptions, and audit logs. There is no other data store (no separate
file storage, no search index, no cache with state that isn't reconstructable
from Postgres). Protecting that one database is the entire backup story.

## Current backup coverage (know this before onboarding a real customer)

Supabase's backup behavior depends entirely on which plan the project is on,
and this is a real gap worth closing before real customer data is involved:

- **Free plan** (commonly the default for a new Supabase project, including
  how this project may currently be configured — check your Supabase
  dashboard's Billing page to confirm which plan is active): **no automatic
  backups at all.** Supabase does not snapshot free-tier projects for you.
  The only protection is backups you take yourself (see below).
- **Pro plan** ($25/mo base): automatic **daily backups, retained 7 days**,
  restorable from the Dashboard (Database → Backups) with a few minutes of
  downtime during restore.
- **Point-in-time recovery (PITR)** — restoring to any specific second, not
  just the last daily snapshot — is a paid add-on on top of Pro/Team/
  Enterprise (roughly $100/mo for a 7-day PITR window), not something the
  base Pro plan includes for free.

**Recommendation, not an automatic action:** before onboarding the first real
paying/pilot customer, upgrade the production Supabase project to at least
**Pro** so daily backups exist without you having to run anything by hand.
This costs money and is your decision to make — nothing in this codebase
upgrades it automatically. Staging can reasonably stay on the free plan
longer since it holds no real customer data, but production should not.

## Manual backups (works on any plan, right now)

Until/unless Pro-tier automatic backups are enabled, take a manual backup
yourself with `pg_dump`, pointed at the **direct** connection (`DIRECT_URL`,
port `5432` — not the pooled `DATABASE_URL`, since pooled connections in
transaction mode don't reliably support the tools `pg_dump` needs):

```bash
# Requires the postgresql-client tools (pg_dump) installed locally.
pg_dump "$DIRECT_URL" --format=custom --file="salesleak-backup-$(date +%Y%m%d).dump"
```

Store the resulting `.dump` file somewhere durable and *not* inside this git
repository (it will contain real customer data once real customers exist) —
a private cloud storage bucket or encrypted local drive is enough at this
scale. There's no built-in scheduler for this in the project; if you want it
automatic without upgrading to Supabase Pro, the simplest option is a cron
job (or a scheduled GitHub Action) running the command above against a
service role connection string, on whatever cadence you're comfortable
losing up to (daily is reasonable for a small pilot customer base).

## Restoring

**From a Supabase Pro-tier automatic backup:** Supabase Dashboard → your
project → Database → Backups → pick a backup → Restore. The dashboard walks
through confirmation; the project is unavailable for the duration of the
restore (a few minutes for a database this size).

**From a manual `pg_dump` file:**

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DIRECT_URL" salesleak-backup-YYYYMMDD.dump
```

Run this against `DIRECT_URL`, never the pooled URL, for the same reason as
the backup step. `--clean --if-exists` drops existing objects before
recreating them, so this is a full replace, not a merge — treat it as
disaster recovery, not a way to selectively undo one bad action (see below
for that).

**After any restore:** run `npx prisma migrate deploy` before letting traffic
back in, in case the backup predates a schema migration that's already
applied in code — this brings the restored database's schema back in sync
with what the currently-deployed app code expects.

## What backups do *not* help with

A full-database restore is the right tool for "the database is gone/
corrupted," not for "someone marked a lead Lost by mistake" — that kind of
single-record mistake is what the product's own **audit log** and activity
timelines are for (every lead/quotation status change, note, and assignment
is already recorded with who/when, visible directly on the record and, for
Owners, via the audit trail). Restoring the whole database to fix one
mistaken click would roll back everything else that happened since, which is
almost always worse than the original mistake. Reach for a backup restore
only for genuine data-loss incidents (accidental `DROP`, failed migration,
provider-side outage), not routine user error.

## Migration failures

Prisma migrations are forward-only (see DEPLOYMENT.md's "Rollback
considerations"). If a migration partially applies and fails, the safest
recovery is usually a small forward-fixing migration, not a restore — restore
only if the database is left in a state the app genuinely can't run against
and a fix-forward migration isn't quickly possible.

## Recovery checklist (disaster scenario)

1. Confirm the scope: is this "database unreachable" (check `/api/health`
   first — see DEPLOYMENT.md) or "database reachable but data is wrong/gone"?
2. If unreachable: check Supabase's own status page and project health
   before assuming data loss — most outages are transient infrastructure
   issues, not data loss.
3. If data is genuinely lost/corrupted: restore the most recent backup
   (Pro-tier dashboard restore, or your latest manual `pg_dump`) following
   the steps above.
4. Run `npx prisma migrate deploy` post-restore.
5. Spot-check: log in as a real user, confirm a known lead/quotation looks
   right, confirm `/api/health` is green.
6. Redeploy the app (`vercel deploy --prod`) only if the restore required
   any environment variable changes; otherwise the existing deployment will
   reconnect on its own once the database is back.
