# Project State

_Living status file — current source of truth for build/verification state. Not a replacement for LAUNCH_CHECKLIST.md, ARCHITECTURE.md, ROADMAP.md, PRODUCT_SPEC.md, DEPLOYMENT.md, BACKUP_RECOVERY.md (all dated Aug 17) or PRE_MAX_HANDOFF.md (dated Aug 21) — those are stale relative to this HEAD._

## Current baseline
- Branch: `main`
- Working tree: clean
- Last verified: 2026-09-09

## Verified this pass (local, full network)
- `npm ci` — PASS
- `prisma generate` — PASS
- `prisma validate` — PASS
- `lint` — PASS
- `tsc --noEmit` — PASS
- `npm run typecheck` (`next typegen && tsc --noEmit`) — PASS
- `npm test` — PASS, 116 tests
- `build` — PASS

## Known deferred items
- npm audit reports 5 high-severity advisories (`deepmerge-ts`, `fast-uri`,
  `mysql2`), all transitive devDependencies of the Prisma CLI and not in the
  production runtime bundle. Deferred deliberately: `audit fix --force` would
  force-downgrade `prisma`. Revisit on a normal Prisma version bump.
- No database-level RLS. Deliberate — app-level tenant isolation is enforced
  at every query and covered by automated tests.
- Supabase remains on the free tier, so the project auto-pauses after
  inactivity (this took production down once). A daily Vercel Cron now pings
  `/api/health` to keep it warm; that is a mitigation, not a fix. Automatic
  backups still require a paid tier.
- Terms and Privacy are honest "not yet published" holding pages. Real legal
  content is a human decision and must not be invented.
- Brand logo PNGs (`salesleak-master-dark.png`, `salesleak-icon-master.png`)
  are fully opaque with a baked-in navy that does not match `--brand-navy`
  (`rgb(11,23,57)`), so a faint rectangle is visible wherever a logo sits on
  navy — most noticeably the login/signup logo. Needs a re-export with a
  transparent background; not fixable in code.

## Commercial-validation status
Not yet started.

## Next recommended action
Commercial validation — speak to the first 2-3 real prospects about whether
SalesLeak beats their current process for catching missed follow-ups.
Infrastructure items (custom domain, Stripe, IndiaMART activation, paid
Supabase tier) stay queued behind that.
