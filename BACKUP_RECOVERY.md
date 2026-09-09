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

Two things have to be true first, and neither was true on the dev machine as
of 2026-09-09. Both were established by actually attempting the backup.

### 1. You need `pg_dump`, version 17 or newer

The production server reports **PostgreSQL 17.6** (verified by query).
`pg_dump` refuses to dump a server newer than itself, so a v15 or v16 client
will fail.

Nothing in this project provides it. Install the PostgreSQL client tools for
your OS — on Windows, the EnterpriseDB installer can install **Command Line
Tools only**, without running a local database server.

Verify with `pg_dump --version` before continuing.

### 2. Use the session pooler, not `DIRECT_URL`

**This is the part that will otherwise waste your afternoon.** The direct host
(`db.<project-ref>.supabase.co`) now resolves to an **IPv6 address only** — no
A record. On any IPv4-only network the connection fails before it starts, with
a misleading `getaddrinfo ENOENT` that looks like the database is down. It is
not; it is unreachable from that network. Supabase sells IPv4 for direct
connections as a paid add-on.

Confirmed on 2026-09-09: `DIRECT_URL` failed with exactly that error, while
the pooler connected on the first attempt.

Use the **session-mode pooler** instead. It is the same host as
`DATABASE_URL` but on **port 5432** rather than 6543, and it is reachable over
IPv4:

```
postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

Port 6543 is transaction mode and will not work for `pg_dump`. Port 5432 on
the pooler host is session mode and will. Both connection strings are in the
Supabase dashboard under Project Settings → Database.

### The command

```bash
pg_dump "postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" \
  --format=custom \
  --no-owner \
  --file="salesleak-backup-$(date +%Y%m%d-%H%M%S).dump"
```

Then confirm the file is a valid archive — this checks readability, **not**
that a restore works:

```bash
pg_restore --list salesleak-backup-YYYYMMDD-HHMMSS.dump | head -40
```

Store the `.dump` somewhere durable and **outside this repository** — it will
contain real customer data. As of 2026-09-09 production holds 8 companies,
15 users and 32 leads, so this is no longer only test data.

Nothing runs this for you. If you want it automatic without upgrading
Supabase, a scheduled GitHub Action running the command above against a
stored connection secret is the cheapest option.

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

## Upgrading Supabase — what a paid tier actually changes

If you have not dealt with Supabase plans before, this is the short version.
Supabase is the managed PostgreSQL provider hosting SalesLeak's only database.
The plan you are on decides what protection you get. Check the current plan in
the Supabase dashboard under **Organization → Billing**.

Today, on the free tier, three things are true and all three are problems:

1. **No automatic backups.** Nothing is snapshotting the database.
2. **The project pauses itself after inactivity.** This already took production
   down on 2026-09-08. The daily cron mitigates it but does not remove it.
3. **Direct connections are IPv6-only**, which is why the backup command above
   has to go through the pooler.

Moving to a paid production tier changes all three: automatic daily backups
appear, projects no longer auto-pause, and an IPv4 add-on becomes available for
direct connections. Point-in-time recovery — rewinding to a specific second
rather than the last daily snapshot — is a further paid add-on on top of that,
and is not needed at pilot scale.

Pricing is not quoted here on purpose; check the current figure on Supabase's
pricing page rather than trusting a number written down months earlier.

**This is a purchase decision and nothing in this repository will make it.**

### After upgrading — do these four things

1. **Confirm a backup actually exists.** Database → Backups should show one
   within a day. A plan change alone proves nothing.
2. **Rehearse a restore.** Restore the latest backup into a *scratch* project,
   run `npx prisma migrate deploy`, and sign in to confirm the data is really
   there. Time it, and write the number down — during a real incident you will
   need to tell someone how long recovery takes. **Never rehearse against
   production.**
3. **Update the "Current reality" section above.** It becomes wrong the moment
   the plan changes, and a stale backup document is worse than none.
4. **Reconsider the keepalive cron.** Paid projects do not auto-pause, so it
   stops being load-bearing. Keeping it is harmless — it doubles as a cheap
   liveness signal — but it is no longer protecting you from anything.

Until all of that is done, this project's honest recovery posture is: **manual
`pg_dump` only, and never yet tested.**
