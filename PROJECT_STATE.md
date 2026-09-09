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

## External activation status

Engineering is frozen. Everything below is an account, a payment, a legal
decision, or a design asset — none of it is code.

| Item | Status | What is prepared | What you must do |
|---|---|---|---|
| **Production backup** | ✅ **First real backup taken 2026-09-09** | `pg_dump` 17.11 installed (client tools only, no server). Dump at `C:\Users\harmy\SalesLeak-Backups\salesleak-prod-20260909-144027.dump` — 288 KB, custom format, validated with `pg_restore --list`: 512 TOC entries, all 19 app tables + `_prisma_migrations` | Repeat before onboarding a real customer; **restore still untested** |
| **Terms of Service** | 🟡 Draft ready, not published | [legal/TERMS_OF_SERVICE.draft.md](legal/TERMS_OF_SERVICE.draft.md) | Resolve markers, get legal review, then replace the holding page |
| **Privacy Policy** | 🟡 Draft ready, not published | [legal/PRIVACY_POLICY.draft.md](legal/PRIVACY_POLICY.draft.md) | Same |
| **Legal decisions** | 🟡 Narrowed by research | [legal/DECISIONS_REQUIRED.md](legal/DECISIONS_REQUIRED.md). DPDP Rules 2025 research closed several questions: Singapore hosting is **permitted**, a DPO is **not required**, and no statutory retention period applies. Still required: a **Grievance Officer** and **≥1 year log retention** | Answer section A, then take the drafts to a lawyer |
| **Support mailbox** | ✅ **Live and verified 2026-09-09** | Account exists on **normal free Gmail** (15 GB quota, no Workspace subscription). Send/receive round-trip tested: message sent 17:11 appeared in both Sent and Inbox. Address matches the 6 references in the product | **Actually read it.** A working mailbox nobody monitors is not support |
| **Supabase paid tier** | ❌ Free Plan — confirmed in dashboard ([billing page](https://supabase.com/dashboard/org/zxtfvrdhvytmsfsfinia/billing)) | Dashboard states verbatim: *"Free Plan does not include project backups."* Pro is **from $25/mo**, includes **daily backups retained 7 days**. Free projects pause after 1 week of inactivity — the documented cause of the 2026-09-08 outage | Approve the upgrade, then rehearse a restore |
| **Uptime monitoring** | ❌ Not set up | Exact monitor configuration in [DEPLOYMENT.md](DEPLOYMENT.md) → Observability | Create a free UptimeRobot/Better Stack account and paste the config |
| **Logo assets** | ❌ Blocked on artwork | All five brand PNGs are colour type 2 (RGB) with **no alpha channel at all**. Searched Desktop, Downloads, Documents, Pictures and OneDrive: **no `.ai`, `.svg`, `.psd`, `.fig` or transparent variant exists anywhere** — the Downloads copies are the same flattened exports | Re-export master logo + icon with transparent backgrounds from wherever the artwork originated |
| **Custom domain** | ✅ Code-ready | No hardcoded Vercel URLs anywhere; everything uses `getAppBaseUrl()` / `APP_URL`. Steps in DEPLOYMENT.md | Buy a domain, add it in Vercel, update `APP_URL` |
| **Stripe** | ✅ Code-ready | [STRIPE_ACTIVATION.md](STRIPE_ACTIVATION.md), re-verified against the code | Follow the runbook, test mode first |
| **IndiaMART** | ✅ Code-ready | Connector follows the published Push API; the webhook URL's own token is the only credential — no IndiaMART API key is ever entered into SalesLeak | Paid IndiaMART seller account, paste the workspace webhook URL into the seller panel, confirm by OTP |

**Pilot-ready:** 🟡 close — the backup exists and the support mailbox is live and
verified. **Published legal pages are the only remaining blocker.** Everything
technical is green.

**Paid-launch-ready:** ❌ not yet — additionally needs Supabase paid tier with
a rehearsed restore, Stripe verified live, uptime alerting, and a domain.

See [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) for the full gate.

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

Engineering is complete for this stage. The first real backup exists and the
support mailbox is live and verified. **Getting the legal drafts reviewed is
now the only thing standing between SalesLeak and a pilot customer** — take
`legal/DECISIONS_REQUIRED.md` to a lawyer, then put SalesLeak in front of 2–3
real prospects. Let their feedback, not further polishing, decide what gets
built next.
