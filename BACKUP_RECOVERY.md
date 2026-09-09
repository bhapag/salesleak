# SalesLeak — Backup & Recovery

Everything SalesLeak stores lives in one managed Postgres database (Supabase):
companies, users, leads, quotations, customers, tasks, activities,
notifications, integrations, subscriptions, and audit logs. There is no other
stateful store — no separate file storage, no search index, no cache holding
anything that isn't reconstructable from Postgres. Protecting that one
database is the entire backup story.

See [DEPLOYMENT.md](DEPLOYMENT.md) for how the database connects to the app and
[ARCHITECTURE.md](ARCHITECTURE.md) for the schema.

## Five words that are not interchangeable

This document is deliberate about these, because conflating them is how a
project ends up believing it is protected when it is not.

| Term | Meaning here |
|---|---|
| **Backup** | A complete copy of the database that can recreate it |
| **Restore** | Actually rebuilding the database from such a copy |
| **Export** | Human-readable extracts of selected data (the CSV feature) |
| **Re-import** | Loading data back in through the app's own import path |
| **Disaster recovery** | The end-to-end procedure when production data is lost |

**The CSV export is export. It is not backup, not restore, and not disaster
recovery.** Its exact limits are characterised below and enforced by tests in
`tests/integration/export-recovery.test.ts`.

## Current reality (verified 2026-09-09)

- The production Supabase project is on the **free tier**. This is not an
  assumption: on 2026-09-08 the project auto-paused after inactivity and took
  production down, which only happens on the free tier.
- **No automatic backups exist.** Supabase does not snapshot free-tier
  projects.
- **Nothing in this repository takes a backup.** There is no scheduled dump,
  no off-platform copy, no retention policy.
- A **daily Vercel Cron** hits `/api/health` (see `vercel.json`), which runs a
  real `SELECT 1`. That prevents the inactivity pause recurring. **It is not
  backup protection** and does nothing if data is deleted or corrupted.
- **No restore has ever been performed or tested** on this project.

## What does NOT exist today

- Automatic database backups
- Point-in-time recovery (PITR)
- A tested restore procedure
- Any automated off-platform backup copy
- Any alerting if a backup were to fail (there are no backups to fail)

Treat the current position as: **if the production database were lost right
now, the data would be gone.** That is the honest state, and it is the single
strongest argument for the Supabase Pro upgrade below.

## Data-export capability (what the app can actually do)

An Owner can export three entities from Settings, as three separate CSV files:
**customers**, **leads**, and **quotations**.

What the export deliberately does **not** capture — verified by test:

- **No database identifiers.** Records reference each other by display name
  only, so relationships cannot be rebuilt mechanically.
- **No tasks, activities, audit logs, users, products, integrations,
  notifications, or subscriptions.** Those entities have no export at all.
- **No quotation line items.** A quotation exports its total value, not what
  was actually quoted.
- **Dates are locale display strings** (`"09 Sept 2026"`), not timestamps —
  no time of day, and the month abbreviation depends on the runtime's locale
  data. A null date exports as an em dash.
- **Enum values are prose** (`NEW` exports as `New`).
- **No contact details on leads** — the leads export has no phone or email
  column, which are exactly the fields the CSV importer needs.

Consequence: **the export cannot be re-imported to reconstruct the workspace.**
The app's CSV import accepts leads only, and the leads export omits the fields
it requires, so a re-import would create fresh `NEW` leads with no contact
details, no status, no ownership, no quotations, and no history.

The export is genuinely useful — it gives a customer their data in a form they
can open in Excel, which matters for trust and for "we never hold your data
hostage." Use it for that. Do not use it as a recovery plan.

## Taking a real backup today

`pg_dump` against the **direct** connection (`DIRECT_URL`, port `5432` — not
the pooled `DATABASE_URL`, since transaction-mode pooling doesn't reliably
support what `pg_dump` needs):

```bash
pg_dump "$DIRECT_URL" --format=custom --file="salesleak-backup-$(date +%Y%m%d).dump"
```

Store the `.dump` somewhere durable and **not** in this repository — it will
contain real customer data once real customers exist.

This is manual. Nothing runs it for you. If you want it automatic without
upgrading Supabase, a scheduled GitHub Action running the command above
against a stored connection string is the cheapest option.

## Restoring

**From a Supabase Pro automatic backup:** Supabase Dashboard → project →
Database → Backups → pick a backup → Restore. The project is unavailable for
the duration.

**From a manual `pg_dump` file:**

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DIRECT_URL" salesleak-backup-YYYYMMDD.dump
```

Use `DIRECT_URL`, never the pooled URL. `--clean --if-exists` drops existing
objects first, so this is a full replace, not a merge.

**After any restore:** run `npx prisma migrate deploy` before letting traffic
back in, in case the backup predates a migration already applied in code.

**Neither path above has been exercised on this project.** The commands are
standard and correct, but "documented" is not "tested". Doing one rehearsal
restore into a scratch database is the single highest-value item in this
document.

## What a restore does not help with

A full restore is for "the database is gone or corrupted", not "someone marked
a lead Lost by mistake". Rolling the whole database back to undo one click
discards everything else that happened since — almost always worse than the
original mistake. Single-record mistakes are what the audit log and activity
timelines are for: every status change, note, and assignment is already
recorded with who and when.

## Migration failures

Prisma migrations are forward-only (see DEPLOYMENT.md's rollback notes). If one
partially applies and fails, a small forward-fixing migration is usually safer
than a restore. Restore only if the database is left in a state the app
genuinely cannot run against.

## Incident procedure

**Scenario A — database unreachable (no data loss).** This is the common case,
and it is what happened on 2026-09-08.

1. Check `/api/health`. A `503` means the app is up but the database is not.
2. Check the Supabase dashboard for a paused project, and Supabase's status
   page for a provider incident.
3. If paused: resume it from the dashboard. The daily cron exists to stop this
   recurring, but a long enough quiet period or a failed cron can still allow
   it.
4. Re-check `/api/health` for `200`, then load a real page while signed in.
5. No restore is involved. Do not restore a backup for an availability problem.

**Scenario B — data genuinely lost or corrupted.**

1. Confirm it is real data loss, not an outage, using Scenario A first.
2. Stop writes if practical, so the damage does not grow.
3. Restore the most recent backup — today that means a manual `pg_dump` file,
   if one exists. **If none exists, there is no recovery path.**
4. Run `npx prisma migrate deploy`.
5. Spot-check: sign in, confirm a known lead and quotation look right, confirm
   `/api/health` is `200`.
6. Redeploy only if environment variables changed; otherwise the running
   deployment reconnects on its own.

## Once Supabase Pro is enabled

Pro (~$25/mo) adds **daily backups retained 7 days**, restorable from the
dashboard. PITR is a further paid add-on. When that upgrade happens:

1. Confirm in Database → Backups that a backup has actually appeared.
2. Do one rehearsal restore into a scratch project and time it.
3. Update the "Current reality" section above — it will be wrong the moment
   the plan changes.
4. Reassess whether the keepalive cron is still needed; paid projects do not
   auto-pause, so it becomes redundant rather than load-bearing.

Until then, this project's honest recovery posture is: **manual `pg_dump`
only, never yet tested.**
