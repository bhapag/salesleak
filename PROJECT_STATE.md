# Project State

_Living status file — current source of truth for build/verification state. Not a replacement for LAUNCH_CHECKLIST.md, ARCHITECTURE.md, ROADMAP.md, PRODUCT_SPEC.md, DEPLOYMENT.md, BACKUP_RECOVERY.md (all dated Aug 17) or PRE_MAX_HANDOFF.md (dated Aug 21) — those are stale relative to this HEAD._

## Current verified baseline
- HEAD: `e31513a34877ed45eba5c7898ceee25605abc8f8`
- Branch: `main`
- Working tree: clean
- Last verified: 2026-08-31

## Verified this pass (local, full network)
- `npm ci` — PASS
- `prisma generate` — PASS
- `prisma validate` — PASS
- `lint` — PASS
- `build` — PASS
- `tsc --noEmit` — PASS

## Known deferred items
- 3 npm audit high-severity advisories, all one transitive issue (`deepmerge-ts` under the Prisma CLI). devDependency only — not in the production runtime bundle. Fix deferred: npm's suggested `audit fix --force` would force-downgrade `prisma` to 6.12.0. Revisit on a normal Prisma version bump, not forced now.

## Commercial-validation status
Not yet started.

## Next recommended action
Commercial validation — identify and speak to the first 2-3 real
prospects on whether SalesLeak beats their current CRM/process for
catching missed follow-ups. Infrastructure items (custom domain,
Stripe, IndiaMART activation, backup-tier upgrade) intentionally
queued behind this.
