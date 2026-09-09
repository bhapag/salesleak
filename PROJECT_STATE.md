# Project State

_The living operational source of truth. Start here._
_Historical detail lives in Git history and the reference docs._

**Last verified: 2026-09-09**

## Current state

| | |
|---|---|
| Branch | `main`, working tree clean |
| Production | Deployed on Vercel, healthy |
| `/api/health` | `200 {"status":"ok"}` |
| Hosted CI | Green on `main` |
| Vercel compute region | `sin1` (Singapore) |
| Supabase region | `ap-southeast-1` (Singapore) — co-located |
| Tests | 122 passing (Vitest) |
| Local checks | lint, typecheck, test, build all pass |

Use `npm run typecheck` (not bare `tsc --noEmit`) — it runs `next typegen`
first, which a clean checkout needs.

## Completed engineering waves

- **Product build (Phases 1–15)** — leads, quotations, customers, tasks, My
  Day, team, ingestion, AI surfaces, billing scaffolding, onboarding.
- **Visual system** — brand navy/gold, design-system primitives, responsive
  passes. Verified: no horizontal overflow on any screen at 375/768/1440.
- **Trust surfaces** — `/terms` and `/privacy` holding pages, `robots.ts`,
  `sitemap.ts`, support address surfaced.
- **Test safety net** — tenant isolation, role permissions, sessions,
  ingestion/AI scoping, production-safety guards. Proven non-vacuous by
  mutation testing.
- **Security** — fixed a cross-tenant `scheduleFollowUp` assignment and
  `passwordHash` reaching client-bound RSC payloads on eight routes; added
  explicit safe User projections and regression coverage.
- **Reliability** — daily keepalive cron, structured logging with redaction.
- **Performance** — functions co-located with the database in `sin1`.
  Measured 13×: pages ~2.27s → ~0.17s.
- **Truth pass** — backup posture, export limits, Stripe runbook, launch gate.

## Current mitigations, not fixes

- **Supabase free tier auto-pause.** A daily Vercel Cron pings `/api/health`
  (`vercel.json`), which runs a real `SELECT 1`. This prevents the inactivity
  pause that took production down on 2026-09-08. **It is not backup
  protection.** See [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md).

## Launch blockers (all human, none are code)

In priority order:

1. **Take a real backup** (`pg_dump`) before any real customer data exists —
   there are currently no backups of any kind.
2. **Publish real Terms and Privacy.** The routes exist as honest holding
   pages; the legal content does not, and must not be invented.
3. **Monitor the support inbox** (`salesleak.support@gmail.com`), already
   surfaced in the product.
4. **Supabase Pro** for automatic daily backups, then rehearse one restore.
5. **Uptime monitoring** pointed at `/api/health` (needs an account).
6. **Transparent logo re-export** — both brand PNGs are opaque with a
   mismatched navy, leaving a visible rectangle on the auth screens.
7. **Custom domain**, **Stripe activation**
   ([STRIPE_ACTIVATION.md](STRIPE_ACTIVATION.md)), **IndiaMART credentials** —
   only when a customer needs them.

See [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) for the full classification and
the pilot-ready vs paid-launch-ready gate.

## Deferred, with reasons

- **Real-Postgres CI tests.** The suite uses an in-memory Prisma substitute
  that genuinely evaluates `where` clauses, so it catches scoping regressions —
  but it does not exercise real SQL, constraints, cascades or transactions.
  Adding a disposable Postgres service container to CI is the right eventual
  fix. Deferred because there is no Docker or local Postgres on the current
  dev machine, so it could only be iterated through push-and-wait CI cycles,
  and it is not a launch blocker. Not worth launch delay.
- **Database-level RLS.** App-level isolation is enforced in every query and
  covered by tests. Revisit only with new evidence.
- **npm audit advisories (5 high).** All transitive devDependencies of the
  Prisma CLI, not in the production runtime bundle. `audit fix --force` would
  downgrade Prisma. Revisit on a normal version bump.
- **My Day over-fetch.** Each helper loads the whole company's records and
  filters in memory. Measured as *not* the latency bottleneck; it is a
  bandwidth concern only at thousands of leads. Documented in
  `src/server/data/myDay.ts`.

## Known operational gotcha

Vercel's build cache can silently skip newly added Tailwind classes — a new
utility appears in the HTML but never in the compiled CSS. If a style seems not
to apply in production, check the deployed stylesheet before suspecting the
source. `vercel deploy --prod --force` rebuilds without cache and resolves it.

## Next recommended action

Engineering is complete for this stage. Take one `pg_dump`, publish real legal
pages, and put SalesLeak in front of 2–3 real prospects. Let their feedback —
not further polishing — decide what gets built next.
