# SalesLeak

A follow-up and quotation tracker for Indian SMB manufacturers, distributors
and traders — the people losing deals because an enquiry never got called back
and a quotation was never chased. SalesLeak surfaces what is slipping, in
rupees, before the revenue is gone.

Built by NobleArc Technologies.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
Prisma 7 on PostgreSQL (Supabase) · Vitest · deployed on Vercel.

Authentication is custom — scrypt hashing with database-backed sessions, no
auth SDK. Stripe and Anthropic are called over plain `fetch`; neither SDK is
installed.

## Running locally

```bash
npm install
npx prisma migrate deploy
npm run dev
```

Requires `DATABASE_URL` (pooled, port 6543) and `DIRECT_URL` (direct, port
5432) in `.env`. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full variable
reference and why the two differ.

```bash
npm run lint        # eslint
npm run typecheck   # next typegen && tsc --noEmit
npm test            # vitest
npm run build       # production build
```

`npm run typecheck` generates Next's route types first — on a clean checkout a
bare `tsc --noEmit` fails without them.

## Where to look

| Document | What it is |
|---|---|
| [PROJECT_STATE.md](PROJECT_STATE.md) | **Start here.** Current verified state, blockers, next action. |
| [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) | What is ready, what needs a human, and the pilot vs paid-launch gate. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Schema, domain model, and how the pieces fit. |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Environments, variables, migrations, troubleshooting. |
| [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) | The honest backup posture, and what the CSV export is not. |
| [STRIPE_ACTIVATION.md](STRIPE_ACTIVATION.md) | Runbook for turning on real billing. |
| [PRODUCT_SPEC.md](PRODUCT_SPEC.md) | What the product does and deliberately does not do. |
| [ROADMAP.md](ROADMAP.md) | Phase history and what was built when. |
| [BRAND.md](BRAND.md) | Brand system and design tokens. |

## Status

Production is deployed and healthy, CI is green, and 122 tests cover tenant
isolation, permissions, sessions, and data-exposure boundaries. Engineering is
substantially complete; what remains before real customers is a short list of
account, payment and legal actions tracked in LAUNCH_CHECKLIST.md.
