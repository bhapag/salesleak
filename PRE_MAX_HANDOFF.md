# SalesLeak pre-Max technical handoff

Mechanical repository inheritance snapshot only. This is not a launch-readiness, security, performance, architecture, or product audit.

## 1. Git baseline

- Repository: `https://github.com/bhapag/salesleak.git`
- Inspected branch: `main`
- Inspected code HEAD: `1250dc93b6623a40be53056b68fc3fe55b33ab97`
- Commit message: `feat: redesign SalesLeak settings and operations experience`
- After a fresh `git fetch origin --prune --tags`, local `main` and `origin/main` were identical (`0` ahead, `0` behind).
- The inherited working tree had no staged, unstaged, or untracked files.
- `v1.0.0-mvp` is an annotated tag that peels to `670dc34e6cb0ebd84b55a7567b0bb5fa0c13e2d1` (`feat: complete SalesLeak launch-ready MVP`).
- This file is the only repository change made by the inheritance pass; its documentation commit is the immediate descendant of the inspected code HEAD.

## 2. Stack and runtime

- Next.js App Router `16.3.1`; React and React DOM `19.2.8`.
- TypeScript `5.9.3`, strict, `noEmit`, ES2017 target, bundler module resolution.
- Tailwind CSS and `@tailwindcss/postcss` `4.3.3`; shared hand-built UI primitives live in `src/components/ui.tsx` and `src/components/badges.tsx`.
- Prisma CLI/client/PG adapter `7.9.1`; `pg` `8.23.0`; PostgreSQL only.
- ESLint `9.39.5`; `eslint-config-next` `16.3.1`; `tsx` `4.23.12`; `dotenv` `17.4.2`.
- npm is the package manager (`package-lock.json`, lockfile version 3). There is no `packageManager`, `engines`, `.nvmrc`, or `.node-version` pin. Locked Prisma packages require Node `^20.19 || ^22.12 || >=24`; Next requires Node `>=20.9.0`.
- Verification host: Node `24.18.0`, npm `11.16.0`.
- Custom authentication uses Node `scrypt`, DB-backed `Session` rows, and an HTTP-only `salesleak_session` cookie. There is no auth SDK.
- Stripe and Anthropic integrations use direct HTTP calls through `fetch`; neither provider SDK is installed.
- Hosting is configured as a standard Next.js Vercel deployment. No static export or custom Next output directory is configured.

## 3. Repository and system map

| Area | Current location |
| --- | --- |
| Root layout, styling, errors | `src/app/layout.tsx`, `src/app/globals.css`, `src/app/error.tsx`, `src/app/not-found.tsx` |
| Authenticated application shell | `src/app/(app)/layout.tsx`, `src/components/Sidebar.tsx`, `src/components/header/` |
| Shared UI | `src/components/ui.tsx`, `src/components/badges.tsx` |
| Login, signup, onboarding | `src/app/login/`, `src/app/signup/`, `src/app/onboarding/`, `src/components/auth/`, `src/components/onboarding/` |
| Dashboard | `src/app/(app)/page.tsx`, `src/server/data/metrics.ts`, `src/lib/attentionItems.ts` |
| Leads and lead detail | `src/app/(app)/leads/`, `src/components/leads/`, `src/server/data/leads.ts`, `src/server/actions/leads.ts` |
| Customers and customer detail | `src/app/(app)/customers/`, `src/components/customers/`, `src/server/data/customers.ts`, `src/lib/customerIntelligence.ts` |
| Quotations | `src/app/(app)/quotations/`, `src/components/quotations/`, `src/server/data/quotations.ts`, `src/server/actions/quotations.ts` |
| Tasks and follow-ups | `src/app/(app)/tasks/`, `src/components/tasks/`, `src/server/data/tasks.ts`, `src/server/actions/tasks.ts`, `src/lib/taskRisk.ts` |
| My Day | `src/app/(app)/my-day/page.tsx`, `src/server/data/myDay.ts` |
| Team management | `src/app/(app)/team/`, `src/components/team/`, `src/server/data/team.ts`, `src/server/actions/users.ts` |
| Company settings | `src/app/(app)/settings/company/`, `src/components/settings/`, `src/server/data/companySettings.ts`, `src/server/actions/company.ts` |
| Billing/subscriptions | `src/app/(app)/settings/billing/`, `src/components/billing/`, `src/server/billing/`, `src/server/actions/billing.ts`, `src/lib/plans.ts` |
| Integrations and ingestion | `src/app/(app)/settings/integrations/`, `src/components/integrations/`, `src/server/ingestion/`, `src/server/data/ingestion.ts`, `src/server/actions/integrations.ts` |
| Sales Process Health | `src/app/(app)/health/page.tsx`, `src/server/data/health.ts` |
| Pilot readiness | `src/app/(app)/settings/pilot-readiness/page.tsx`, `src/server/data/pilotReadiness.ts` |
| Notifications | `src/components/header/NotificationBell.tsx`, `src/server/data/notifications.ts`, `src/server/actions/notifications.ts`, `src/lib/notificationHref.ts` |
| Global search | `src/components/header/GlobalSearch.tsx`, `src/server/actions/search.ts` |
| CSV import/export | `src/app/(app)/leads/import/`, `src/components/leads/CsvImportWizard.tsx`, `src/server/actions/ingestion.ts`, `src/server/actions/export.ts`, `src/lib/csv.ts`, `src/lib/csvMapping.ts` |
| AI features | `src/components/ai/`, `src/server/ai/`, `src/server/actions/ai.ts`, `src/server/data/ai.ts` |
| Public website form | `src/app/website-form/[token]/page.tsx` |
| API health | `src/app/api/health/route.ts` |
| Provider webhooks | `src/app/api/webhooks/[provider]/[token]/route.ts`, `src/app/api/webhooks/stripe/route.ts` |
| Auth, session, permissions | `src/server/auth/session.ts`, `src/server/auth/password.ts`, `src/server/auth/permissions.ts`, `src/server/actions/auth.ts` |
| Tenant/company isolation | `src/server/auth/permissions.ts` plus company-scoped reads and re-fetches in `src/server/data/` and `src/server/actions/` |
| Activity and audit storage | Prisma `Activity` and `AuditLog`; activity readers are embedded in lead, quotation, customer, and team data/UI |
| Date/time and risk helpers | `src/lib/timezone.ts`, `src/lib/format.ts`, `src/lib/taskRisk.ts`, `src/lib/leadRisk.ts`, `src/lib/quotationRisk.ts` |
| Validation and normalization | `src/server/ingestion/validate.ts`, provider connectors in `src/server/ingestion/connectors/`, `src/server/ai/schema.ts`, `src/lib/contactMatch.ts` |
| General server actions/data | `src/server/actions/`, `src/server/data/` |
| Scripts | `prisma/seed.ts`, `scripts/assignFoundingPlan.ts` |

Registered ingestion webhook adapters are IndiaMART and Website Forms. The email parser exists but has no live inbound route. Other catalogue connectors are presented as not yet live. CSV Import and Manual Entry do not require webhook adapters.

There is no standalone activity page, audit-log reader UI, notifications page, search page, customer action module, test suite, test-runner configuration, CI workflow, or `/settings` index route in the current tree.

## 4. Database baseline

- Schema: `prisma/schema.prisma`; CLI config: `prisma.config.ts`; runtime client: `src/lib/prisma.ts`.
- Provider: PostgreSQL. The application uses `DATABASE_URL` through `PrismaPg`; the Prisma CLI uses `DIRECT_URL` and falls back to `DATABASE_URL`.
- Generated client: `src/generated/prisma/` (Git-ignored; generated by `postinstall`).
- Nineteen models: `Company`, `User`, `Session`, `Customer`, `Lead`, `Activity`, `Task`, `Product`, `Quotation`, `QuotationItem`, `Integration`, `IngestionBatch`, `IngestionRecord`, `FailedIngestion`, `AiInsight`, `AiUsageLog`, `Notification`, `AuditLog`, `Subscription`.
- Fourteen enums: `UserRole`, `LeadSource`, `LeadStatus`, `LeadPriority`, `ActivityType`, `TaskStatus`, `QuotationStatus`, `IntegrationType`, `IntegrationStatus`, `IngestionRecordStatus`, `FailedIngestionStatus`, `AiInsightKind`, `SubscriptionPlan`, `SubscriptionStatus`.
- Committed migrations:
  - `prisma/migrations/20260816085308_init/`
  - `prisma/migrations/20260816181043_add_subscription_model/`
  - `prisma/migrations/20260818183349_quotation_company_scope_and_sequence/`
  - `prisma/migrations/20260818190229_align_quotation_sequence_with_history/`
- `prisma/seed.ts` deletes and recreates fictional demo data and refuses to run when `NODE_ENV=production`. It was not run.
- `scripts/assignFoundingPlan.ts` mutates a company subscription and audit log. It was not run.
- Live database contents and migration status were not queried during this pass.

## 5. Environment-variable map

Only variable names are listed.

- Database: `DATABASE_URL`, `DIRECT_URL`.
- Application/platform: `APP_URL`, `VERCEL_URL`, `NODE_ENV`, `NEXT_RUNTIME`.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`.
- AI: `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_INGESTION_ENRICHMENT`.
- Email, monitoring, and other external services: no environment-variable names are consumed by current code.

`.env.example` exists and includes the database, application URL, and AI variables. The four Stripe variables are consumed by code and documented in `DEPLOYMENT.md` but are not listed in `.env.example`. No `.env` file or secret value was read or recorded.

`APP_URL` resolves through `APP_URL`, then `VERCEL_URL`, then localhost. Current server consumers are application metadata and Stripe redirect URLs. Integration URLs shown in the UI use the browser origin.

## 6. Authentication, billing, integrations, and AI baseline

- Roles are `OWNER`, `SALES_MANAGER`, and `SALESPERSON`; shared role/tenant helpers live in `src/server/auth/permissions.ts`.
- Sessions last 30 days and are stored in the database. Cookie flags are HTTP-only, SameSite Lax, and Secure in production.
- Subscription plans are `FOUNDING`, `STARTER`, and `GROWTH`; checkout, portal, webhook verification, and entitlements live under `src/server/billing/`.
- Stripe configuration is optional; unconfigured code paths return an explicit non-connected state.
- IndiaMART is registered in test mode; Website Forms can be connected. Ingestion sources converge on `src/server/ingestion/pipeline.ts`.
- Anthropic access is optional. Without `ANTHROPIC_API_KEY`, the provider reports mock mode. `AI_MODEL` overrides the code default, and ingestion enrichment is enabled only when `AI_INGESTION_ENRICHMENT` is exactly `true`.

## 7. Commands and actual verification results

| Command | Result | Evidence/notes |
| --- | --- | --- |
| `npm ci` | **PASS** | Installed 502 packages from the lockfile; `postinstall` generated Prisma Client 7.9.1. npm's install summary reported three high-severity advisories; `npm audit` was not run because security auditing was outside this task. |
| `npm run lint` | **PASS** | ESLint exited 0 with no reported warnings or errors. |
| `npx tsc --noEmit` before a Next build | **FAIL** | `src/app/layout.tsx(32,50): error TS2304: Cannot find name 'LayoutProps'.` A fresh clone did not yet contain Next-generated `.next/types`. No code was changed. |
| `npx prisma validate` | **PASS** | `prisma/schema.prisma` reported valid; no database connection was made. |
| `npx prisma generate` | **PASS** | Generated Prisma Client 7.9.1 into `src/generated/prisma`. |
| `npm run build` | **PASS** | Next.js 16.3.1 production build compiled, ran its TypeScript phase, and generated all listed routes successfully. |
| `npx tsc --noEmit` after `npm run build` | **PASS** | Exited 0 after Next generated route/layout types. |
| Automated tests | **NOT EXECUTED** | No `test` script, test/spec/e2e files, test-runner dependency, or test-runner configuration exists. |
| `npx prisma migrate status` | **NOT EXECUTED — EXTERNAL REQUIREMENT** | Requires an authorized, reachable direct PostgreSQL connection. |
| `npm run dev` / `npm run start` | **NOT EXECUTED — EXTERNAL REQUIREMENT** | A useful runtime smoke test requires `DATABASE_URL`; production startup validates it. |
| `npm run db:migrate:dev`, `npm run db:migrate:deploy`, `npm run db:seed`, `npm run db:studio` | **NOT EXECUTED — EXTERNAL REQUIREMENT** | Require a database and can change external state; seed is deliberately destructive. |

There is no package-level `typecheck` command. On a fresh checkout, use `npm run build` (which performs Next type generation and a TypeScript phase) before a standalone `npx tsc --noEmit`, or explicitly generate Next route types first.

## 8. Deployment baseline

- Repository build command: `npm run build` -> `next build`.
- Runtime command: `npm start` -> `next start`.
- Install lifecycle: `npm ci`/`npm install` invokes `prisma generate` through `postinstall`.
- Output is the default Next.js `.next/`; no custom `output`, `distDir`, `basePath`, redirects, or rewrites are configured.
- Database migrations are deliberately separate from install/build; `DEPLOYMENT.md` documents `npx prisma migrate deploy` as an explicit operator step.
- `.vercelignore` excludes local environment files. There is no tracked `vercel.json`, `.vercel/` link metadata, CI/CD workflow, Dockerfile, or Procfile.
- Documentation names the existing Vercel project as `salesleak` and staging URL as `https://salesleak-theta.vercel.app`. The checked-in repository does not contain Vercel project/team IDs, so that external linkage was not independently verified.
- Application source does not hard-code the staging hostname. Base URLs derive from environment/browser origin.
- `GET /api/health` executes `SELECT 1` and returns HTTP 200 with `{"status":"ok"}` or HTTP 503 with `{"status":"error"}`.
- No production deployment was performed.

## 9. Existing documentation

- `ARCHITECTURE.md`: current technical architecture, data model, flows, auth, billing, integrations, AI, and historical implementation notes.
- `PRODUCT_SPEC.md`: product purpose, roles, workflows, billing, health/risk, repeat-revenue, AI, and exclusions.
- `ROADMAP.md`: completed phases and deferred work.
- `BRAND.md`: SalesLeak/NobleArc hierarchy, colors, assets, and usage rules.
- `DEPLOYMENT.md`: local setup, environment, Supabase/Prisma operations, seed safety, Vercel, rollback, AI/Stripe, and troubleshooting.
- `BACKUP_RECOVERY.md`: PostgreSQL backup, restore, verification, and recovery procedures.
- `LAUNCH_CHECKLIST.md`: existing readiness ledger and historical status assertions.
- `README.md`: mostly create-next-app boilerplate; its reference to `app/page.tsx` does not match the current `src/app/(app)/page.tsx` dashboard path.
- `AGENTS.md`: generated Next.js agent guidance.
- `CLAUDE.md`: pointer to `AGENTS.md`.

Directly observable documentation/configuration deltas are limited to factual inheritance notes here: `.env.example` omits the Stripe names used by code; some `APP_URL` descriptions predate its current metadata/Stripe consumers; and the documented Vercel/Supabase live state cannot be proven from checked-in files alone.

## 10. External prerequisites for a later audit

- Authorized access to the target PostgreSQL/Supabase environment is required to verify live migration status, data state, tenant counts, backup status, or database-dependent runtime behavior.
- Vercel project access is required to verify project linkage, deployment history, configured environment variables, domains, and production logs.
- Stripe credentials/account access are required to verify live checkout, portal, webhook, price, and subscription state.
- Anthropic credentials are required to verify real provider responses; without them the application deliberately uses mock mode.
- A live IndiaMART account/payload source is required to validate behavior beyond the registered test-mode adapter.
- This checkout contains no test suite or CI workflow to inherit.

## 11. Before the real Claude Max audit

- Treat `1250dc93b6623a40be53056b68fc3fe55b33ab97` as the verified application-code baseline; the following commit is documentation-only.
- Re-establish Git synchronization and external access before making live-state claims.
- Use current code/config/schema before historical status statements in documentation.
- The inheritance pass did not change application code, schema, migrations, configuration, product behavior, or external state.
