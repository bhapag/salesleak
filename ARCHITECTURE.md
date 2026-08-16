# SalesLeak — Architecture

## Stack

- **Next.js (App Router, TypeScript)** — server components for data fetching, server actions for mutations, no separate API layer for internal CRUD (except the one webhook route).
- **Tailwind CSS** — styling.
- **Prisma 7 + PostgreSQL** (Supabase in staging/production) — see "PostgreSQL & connection architecture" below for the pooled-vs-direct split and why it's not the "obvious" `directUrl` config.
- **Local authentication, DB-backed sessions.** Login/logout, scrypt password hashing, and a `Session` table (random token in an httpOnly cookie) — no JWTs, no third-party auth provider. Every tenant-scoped query is filtered server-side by `session.companyId`. See "Authentication & multi-tenancy" below.
- **Deployed on Vercel**, staging environment only so far (no custom domain). See DEPLOYMENT.md for the operational how-to; this file covers the how-it-works.

## PostgreSQL & connection architecture

Through Phase 10 this project used SQLite (`@prisma/adapter-libsql`) for local dev, since this machine has no C++ build toolchain and the Prisma-recommended `better-sqlite3` needs one. Phase 11 moved fully to PostgreSQL — `pg` is pure JS with no native build step, so the same toolchain constraint that ruled out `better-sqlite3` was a non-issue here.

**Driver adapter**: `src/lib/prisma.ts` constructs `new PrismaPg({ connectionString: process.env.DATABASE_URL })` and passes it to `PrismaClient({ adapter })` — this is the app's *only* source of truth for its database connection at runtime; nothing about how the Prisma CLI is configured (below) affects it.

**Pooled vs. direct connections, and why the split is done by hand.** Supabase (like most managed Postgres) provides two connection strings: a *pooled* one (PgBouncer in transaction mode, port `6543`) safe for many concurrent short-lived connections — exactly what a serverless deployment's app runtime needs — and a *direct* one (port `5432`) that a transaction-mode pooler can't substitute for when running DDL, because migrations need prepared statements the pooler doesn't support. The "obvious" Prisma mechanism for this is `datasource db { url = env("DATABASE_URL") directUrl = env("DIRECT_URL") }` in `schema.prisma` — but the installed Prisma 7.9.1 **hard-rejects** `url`/`directUrl` in that block entirely (a real, verified-by-running-it error: `P1012 ... property 'url' is no longer supported in schema files`), directing you instead to `prisma.config.ts` — whose `datasource` type (checked directly against `node_modules/@prisma/config`'s shipped `.d.ts`) only has `url` and `shadowDatabaseUrl`, no `directUrl`, despite some external docs describing one. So:

- `prisma.config.ts`'s one `url` always points at the **direct** connection (`DIRECT_URL`, falling back to `DATABASE_URL` for a plain local Postgres with no pooler in front of it) — this is what `prisma migrate`/`db seed`/`studio` use.
- The running app's driver adapter reads `DATABASE_URL` (the **pooled** connection) directly from `process.env`, entirely independent of `prisma.config.ts`.

Both env vars are documented in `.env.example` and DEPLOYMENT.md. If a future Prisma release adds real `directUrl` support to `prisma.config.ts`, this hand-split can be simplified — but there's no urgency, since the current setup is correct and this comment (mirrored in `prisma.config.ts` and `schema.prisma`) explains why it looks unusual.

## Folder structure

```
prisma/
  schema.prisma       — all models, single source of truth for the data model
  seed.ts             — realistic sample data for one fake company
  migrations/         — Prisma migration history (committed, never hand-edited)
src/
  app/
    layout.tsx         — root shell: fonts, metadata only (no sidebar/header — those
                         belong to the (app) group, since /login shouldn't show them)
    login/
      page.tsx           — public login page (/login), redirects to / if already
                           signed in, shows demo accounts + password when not in production
    signup/
      page.tsx           — public signup page (/signup): creates a new Company +
                           Owner User + default Integration rows, signs in, and
                           the SignupForm redirects to /onboarding on success
    onboarding/
      page.tsx           — 7-step onboarding wizard (/onboarding), Owner-only,
                           redirects away if the company is already onboarded
                           (company.onboardedAt set) or if role !== OWNER
    error.tsx, not-found.tsx — root-level boundaries for anything outside the
                           authenticated (app) shell (public pages, unmatched URLs)
    (app)/               — route group: every authenticated page lives under here
      layout.tsx           — calls requireSession() (redirects to /login if absent);
                             for an OWNER whose company has no onboardedAt, redirects
                             to /onboarding before rendering anything; otherwise
                             renders Sidebar + AppHeader around {children}
      error.tsx             — error boundary scoped to the (app) group: keeps the
                             Sidebar/AppHeader shell visible, shows a friendly
                             message + Try Again/back-to-Dashboard, never a stack trace
      health/
        page.tsx             — Sales Process Health (/health) — Owner + Sales
                             Manager only
      page.tsx              — dashboard (/): stats, Money at Risk, Attention Required, Team Snapshot
      leads/
        page.tsx             — leads list (/leads), owner-scoped for Salespeople
        [id]/page.tsx         — lead detail (/leads/[id])
      quotations/
        page.tsx             — quotations list (/quotations), owner-scoped for Salespeople
        [id]/page.tsx         — quotation detail (/quotations/[id])
      customers/
        page.tsx             — customers list (/customers)
        [id]/page.tsx         — customer detail (/customers/[id]) — read-only, no actions
      team/
        page.tsx             — management team page (/team) — Owner/Manager only,
                               Owner additionally sees the Manage Team card
        [id]/page.tsx         — salesperson detail (/team/[id]) — read-only, Owner/Manager only
      tasks/
        page.tsx             — company-wide daily work queue (/tasks)
      my-day/
        page.tsx             — personal work queue for the current user (/my-day)
      leads/
        import/page.tsx       — CSV import wizard (/leads/import)
      settings/
        company/page.tsx      — company settings (/settings/company) — Owner only
        integrations/page.tsx  — connector grid, test console, failed-ingestion
                               queue, import history (/settings/integrations)
                               — Owner + Sales Manager, same tier as /team
    api/
      webhooks/[provider]/[token]/route.ts — the one real API route in the app
                               (everything else is server actions). POST-only;
                               all logic lives in webhookHandler.ts (see below)
                               — this file just adapts Request/Response to it
      health/route.ts           — GET /api/health (Phase 11): app+DB liveness
                               only (`SELECT 1`), no credentials/env/customer
                               data in the response ever
    website-form/[token]/page.tsx — public, unauthenticated: the Website Forms
                               connector's actual embeddable form AND the local
                               dev test page for it (same page, same POST target)
  components/
    Sidebar.tsx, badges.tsx, ui.tsx — shared presentational pieces
    header/                — AppHeader (server) + NotificationBell (client), ProfileMenu
                             (client, logout), GlobalSearch (client, Ctrl/Cmd+K)
    auth/                  — LoginForm, SignupForm (client), NotAuthorized (presentational
                             "not permitted" page)
    onboarding/             — OnboardingWizard.tsx: the entire 7-step flow as client-side
                             state in one component; settings/team-member data is only
                             persisted server-side when the wizard actually reaches the
                             relevant step, never eagerly
    settings/               — CompanySettingsForm (client, incl. Sales Workflow section),
                             DemoResetCard (client, dev-only)
    team/                   — ManageTeamCard (client): add/edit/deactivate users
    leads/, quotations/, customers/, tasks/ — page-specific tables and detail-view cards
    leads/AddLeadCard.tsx    — inline expand-in-place manual lead form (same
                              pattern as ManageTeamCard), on /leads
    leads/CsvImportWizard.tsx — Upload → Map → Preview & Validate → Import stepper
    integrations/IntegrationCard.tsx — per-connector setup, monitoring, and
                              the "Send Test Payload" console (client)
    integrations/FailedIngestionQueue.tsx — inspect/correct/retry/dismiss
                              failed external payloads (client)
    integrations/WebsiteFormDemo.tsx — the actual form rendered on the public
                              /website-form/[token] page (client, POSTs to the
                              webhook endpoint directly — not a server action,
                              since a real embedded form has no session)
    ai/
      AiBadge.tsx                — small muted "✦ AI" pill, the one visual
                              marker every AI-assisted surface carries
      AiLeadInsightsCard.tsx       — summary + advisory priority + next-action
                              suggestion + Approve & Schedule, on Lead Detail
      AiCustomerSummaryCard.tsx     — relationship summary, on Customer Detail
      AiSalesBrief.tsx                — dashboard section, next to Money at Risk
      AiEnquiryExtractor.tsx           — the "paste messy text" panel embedded
                              inside AddLeadCard
  lib/
    prisma.ts           — Prisma client singleton (adapter-wired)
    env.ts                — validateEnv() (Phase 11): checked at server
                          startup via instrumentation.ts, deliberately never
                          imported by prisma.ts itself (would break `next
                          build`'s page-data collection — see the PostgreSQL
                          section above)
    logger.ts              — structured JSON-line logging (Phase 11):
                          auth/database/ingestion/webhook/AI failure
                          categories, defensive key-based secret redaction
    rateLimit.ts             — checkRateLimit() + getClientIp() (Phase 11):
                          generalized from the Phase 8 webhook-only rate
                          limiter, now shared with login()/signup()
    appUrl.ts                 — getAppBaseUrl() (Phase 11): forward-looking
                          server-side base-URL helper; nothing currently
                          requires it since the webhook-URL display already
                          derives from window.location.origin client-side
    csv.ts               — hand-rolled CSV parser (quoted fields, embedded
                          commas/newlines, ragged rows — no new dependency)
    csvMapping.ts         — CSV-column ↔ SalesLeak-field mapping: synonym-based
                          auto-detection, free-text source/date/currency parsing
    contactMatch.ts        — normalizePhone/normalizeEmail, shared by the
                          server-side duplicate checker and the CSV wizard's
                          client-side preview so both agree on "same contact"
    leadRisk.ts          — single source of truth for "is this lead at risk" logic
    quotationRisk.ts      — same pattern for quotations: overdue follow-up, missing
                             next action, stale (no recent activity), and the
                             derived "Follow-up Due" display status
    taskRisk.ts            — same pattern for tasks: Overdue/Due Today/Upcoming/
                             Completed bucketing + "seriously overdue" (3+ days)
    customerIntelligence.ts — rule-based, no-AI: customer status (Prospect/Active/
                             Repeat/Dormant/Lost) and the repeat-order signal
                             (Normal/Due Soon/Repeat Order Due/Overdue-Dormant),
                             both derived from lead history, never stored
    attentionItems.ts       — builds a "needs attention" row from a lead/quotation/
                             customer; shared by the dashboard's Attention Required
                             feed and the per-salesperson Needs Attention section
  server/
    ai/
      types.ts                 — AIProvider interface (isConfigured, generateJSON)
                              and AIGenerateOutcome — the entire provider contract
      schema.ts                  — validateObject (tiny dependency-free structured-
                              output validator) + extractJson (pulls a JSON object
                              out of possibly-prose/fenced model output, never throws)
      client.ts                   — generateStructured(): the one entry point every
                              feature calls. No configured provider -> a feature's
                              own mockResult() runs immediately (dev mode, always
                              labeled). Configured -> real call with timeout, JSON
                              extraction, schema validation; ANY failure returns an
                              honest {ok:false} — never a silent mock substitution.
                              Every call (mocked or real, success or fail) writes
                              one AiUsageLog row
      providers/
        anthropic.ts               — AnthropicProvider: plain fetch against the
                              Messages API (no SDK dependency for one HTTP call).
                              isConfigured() checks ANTHROPIC_API_KEY. Swapping
                              providers means writing one more file matching
                              AIProvider — nothing else references this class by name
      features/
        enquiryExtraction.ts        — messy-text -> structured lead fields. Schema
                              makes every field nullable except by design (AI must
                              never invent what isn't stated); mock does a few
                              honest regex passes (phone/quantity/urgency/"X this
                              side" name pattern), never a fabricated guess
        leadInsights.ts               — ONE generation bundling summary + advisory
                              priority signal (with a required one-sentence reason)
                              + next-action suggestion + suggested deadline days —
                              deliberately one AI call instead of three, since all
                              three concern the same lead context (cost control)
        customerSummary.ts             — relationship summary + one outstanding
                              action, from a condensed CustomerDetail digest
        salesBrief.ts                    — a few bullet lines from already-computed
                              DashboardData figures — never raw DB rows
        enrichIngestion.ts                — optional, OFF BY DEFAULT
                              (AI_INGESTION_ENRICHMENT env flag) ingestion-pipeline
                              hook: fills only missing structured fields from a
                              source's free text, never overrides a provider-
                              supplied field. Architecture prep for a future
                              mostly-free-text connector, not activated this phase
    ingestion/
      types.ts               — NormalizedLeadInput: the one shape every source
                              (manual, CSV, future connectors) must produce
                              before anything touches Lead/Customer
      validate.ts              — validateNormalizedLead: the only hard
                              requirement is a customer/company name
      duplicates.ts             — checkForDuplicate: exact (source +
                              externalLeadId already ingested) vs possible
                              (matched customer has a very recent open lead)
      pipeline.ts                — ingestLead(): validate → duplicate check →
                              find/create customer → create lead → activity →
                              notify → record IngestionRecord. The single path
                              every source funnels through — see "Ingestion
                              architecture" below
      security.ts                — webhook token/signing-secret generation,
                              HMAC verification, timestamp freshness, an
                              in-memory rate limiter (see "External integration
                              architecture" below)
      webhookHandler.ts           — processProviderPayload() (parse → ingest →
                              record, shared by the real webhook route and the
                              authenticated test console) and
                              handleWebhookRequest() (adds token resolution,
                              rate limiting, signature check — the real HTTP
                              entry point's logic, kept out of route.ts)
      connectors/
        types.ts                  — ProviderAdapter interface: parse(),
                                  samplePayload(), a type + URL slug
        indiamart.ts                — IndiaMART adapter, built against their
                                  documented lead-push field names (never
                                  tested against a live account — no
                                  credentials/access provided)
        website.ts                   — Website Forms adapter, matches the
                                  payload the public demo form actually sends
        email.ts                      — email normalization prep ONLY — no
                                  route, not in registry.ts, no OAuth. Exists
                                  so a future Gmail/IMAP connector has a
                                  target shape to build against
        emailFixtures.ts               — mock inbound emails for exercising
                                  email.ts in development
        registry.ts                     — WEBHOOK_ADAPTERS: URL-slug → adapter
                                  map used by webhookHandler.ts; deliberately
                                  excludes the email adapter
    auth/
      password.ts          — hashPassword/verifyPassword: scrypt + random salt +
                              timingSafeEqual, Node's built-in crypto only (no bcrypt —
                              avoids a native-module build on a machine with no C++ toolchain)
      session.ts            — createSession/destroySession/getSession/requireSession.
                              Sessions are DB rows (Session model); a random token lives
                              in an httpOnly/sameSite/secure cookie. getSession() is
                              wrapped in React's cache() since layouts and pages can't
                              share props in the App Router and both need the session
      permissions.ts         — canManageTeam, canManageCompany, getOwnerScope,
                              assertSameCompany, ForbiddenError — reusable authorization
                              helpers so role/tenant checks are never scattered inline
    actions/
      auth.ts               — login, signup (same {success,error} pattern — neither
                              calls redirect() itself, so the client form can navigate
                              via router.push after seeing success; signup creates the
                              Company + Owner User + default Integration rows via
                              getDefaultIntegrationRows(), then createSession()),
                              logout (calls redirect() directly — safe here).
                              Both login (8/5min, per email) and signup (5/hour,
                              per IP) are rate-limited (Phase 11, checkRateLimit())
                              and log a logger.authFailure() on rejection
      onboarding.ts           — saveOnboardingSettings (company details + all
                              workflow-settings fields in one write, called once when
                              the wizard leaves the follow-up-defaults step),
                              addTeamMemberDuringOnboarding (wraps users.ts's
                              createTeamUser with a generated temporary password),
                              completeOnboarding (sets Company.onboardedAt, writes an
                              ONBOARDING_COMPLETED audit log) — all Owner-only
      search.ts                — globalSearch: one tenant-scoped server action
                              querying customers/leads/quotations by name, company
                              name, phone, email, or quotation number in parallel
      dev.ts                    — resetDemoData: hard-gated on
                              process.env.NODE_ENV !== "production" (checked in the
                              action itself, not just hidden in the UI), Owner-only,
                              requires an exact typed confirmation phrase, spawns
                              `npx prisma db seed` as a child process, then destroys
                              the caller's own session and redirects to /login (the
                              reseed wipes the Session table too)
      leads.ts               — server actions: status changes, assignment, notes,
                              follow-ups, won/lost. Every action starts with
                              requireSession() then getOwnedLead() (findFirst scoped
                              by companyId, throws ForbiddenError otherwise)
                              (assignSalesperson also fires a NEW_LEAD_ASSIGNED
                              notification and writes a LEAD_OWNER_CHANGED audit log;
                              markWon/markLost write LEAD_WON/LEAD_LOST)
      quotations.ts           — same pattern for quotations, via getOwnedQuotation()
                              (findFirst on lead.companyId — Quotation has no direct
                              companyId column); every action also writes an Activity
                              onto the *linked Lead* (see below); status-changing
                              actions write a QUOTATION_STATUS_CHANGED audit log
      tasks.ts                 — rescheduleTask (mark-complete reuses leads.ts's
                              completeTask), tenant-checked via lead.companyId
      notifications.ts         — markNotificationRead, markAllNotificationsRead —
                              both session-scoped, no client-supplied companyId/userId
      company.ts                — updateCompanySettings — Owner-only, now also
                              accepts the Sales Workflow fields (highValueThreshold,
                              staleQuotationDays, defaultFollowUpDays, defaultPriority,
                              lostReasonPresets, activeLeadSources), writes a
                              COMPANY_SETTINGS_CHANGED audit log
      users.ts                   — createTeamUser, updateUserRole, setUserActive —
                              all Owner-only; setUserActive(false) also deletes the
                              target user's Session rows (immediate logout everywhere);
                              these write USER_CREATED/USER_ROLE_CHANGED/
                              USER_ACTIVATED/USER_DEACTIVATED audit logs
                              (no customers.ts — the Customer pages are read-only)
      ingestion.ts                — createManualLead (manual entry form),
                              importCsvLeads (CSV wizard's confirm step — the
                              server-side source of truth; re-validates and
                              re-checks duplicates row by row regardless of
                              what the client's preview showed; writes one
                              CSV_IMPORT_COMPLETED audit log per batch, not per row),
                              getExistingContactsForImportPreview (feeds the
                              CSV wizard's client-side duplicate hints)
      integrations.ts              — generateWebhookConfig, regenerateSigningSecret,
                              toggleIntegrationEnabled, sendTestPayload (drives
                              the in-app test console via processProviderPayload,
                              no HTTP round trip), retryFailedIngestion (accepts
                              user corrections, re-runs through ingestLead()),
                              dismissFailedIngestion — all Owner+Manager-gated,
                              tenant-scoped; all but sendTestPayload (a trivial,
                              non-business-changing test action) write an AuditLog
                              entry (INTEGRATION_CONFIGURED/_SECRET_REGENERATED/
                              _TOGGLED, FAILED_INGESTION_RETRIED/_DISMISSED)
      ai.ts                          — getLeadInsights/getCustomerInsights/
                              getSalesBrief (check AiInsight cache by
                              sourceVersion, generate + upsert on miss or
                              force), extractEnquiryFromText (no caching —
                              one-off preview), approveNextActionSuggestion
                              (the ONLY path an AI suggestion can become a
                              real change — calls the existing Phase 2
                              scheduleFollowUp() unchanged, after a human
                              clicks Approve)
    data/
      companySettings.ts              — getCompanyRiskThresholds: the one place
                              that reads a company's highValueThreshold/
                              staleQuotationDays, so leads.ts/quotations.ts/
                              customers.ts never each hand-roll that lookup
      health.ts                       — getSalesHealthReport: Sales Process Health's
                              only new query logic, and even it just re-filters the
                              output of getLeadsForCompany/getQuotationsForCompany/
                              getCustomersForCompany/getFailedIngestions — never a
                              parallel/duplicate risk computation
      ai.ts                          — getCachedInsight/upsertInsight: tenant-
                              scoped storage for AiInsight, keyed by
                              (companyId, kind, entityType, entityId)
      ingestion.ts             — getIntegrationsForCompany (merges DB rows with
                              a static connector catalog, so a connector with
                              no Integration row yet still shows "Coming Soon"
                              rather than being missing; also computes a
                              simple health indicator), getIngestionHistory,
                              getFailedIngestions
      leads.ts, quotations.ts — query + risk-attach helpers reused by every page
                                that lists or details leads/quotations; detail
                                lookups (getLeadDetail, getQuotationDetail) take an
                                explicit companyId and use findFirst, not findUnique;
                                both call getCompanyRiskThresholds() alongside the
                                main query so risk is computed against each
                                company's own configured thresholds, not a hardcoded
                                default
      customers.ts            — query + customerIntelligence-attach helper, plus
                                the chronological timeline builder for the customer
                                detail page (merges enquiries/quotations/won/lost/
                                activities from all of a customer's leads); detail
                                lookup is companyId-scoped the same way as above
      tasks.ts                — getWorkQueueForCompany: fetches tasks, attaches
                                taskRisk, buckets into Overdue/Due Today/Upcoming/
                                Completed, optional per-user filter. Reused by
                                /tasks, /my-day, and /team/[id]'s Today/Upcoming.
      team.ts                 — getTeamOverview (per-salesperson row, used by both
                                /team and the dashboard's Team Snapshot) and
                                getSalespersonDetail (/team/[id]'s sections)
      myDay.ts                 — getMyDayData: personal filter over the same
                                lead/quotation/customer/task services, no new logic
      notifications.ts         — syncNotifications generates real Notification rows
                                from the same risk logic other pages use, deduped
                                per (company, type, entity, recipient) via a DB
                                unique constraint (see below); getNotificationsForUser
                                calls it before reading, so notifications are
                                always current without a background job
      metrics.ts             — dashboard-only aggregation: stats, Money at Risk,
                                Attention Required, Team Snapshot, Repeat Revenue
                                Opportunities, and small Work Today figures. Built
                                entirely from the other data/ modules' output, so
                                risk logic is never recomputed or duplicated here.
                                Takes both companyId and userId (for the unread
                                notification count) rather than resolving a user itself.
  generated/prisma/     — generated Prisma client (gitignored, regenerated on install)
  instrumentation.ts     — register() (Phase 11): env validation at real
                          server startup, never during `next build`.
                          onRequestError(): catch-all structured logging for
                          anything uncaught, across Server Components/Route
                          Handlers/Server Actions
```

## Data model notes

- Every tenant-scoped model (`User`, `Customer`, `Lead`, `Product`, `Integration`, `Notification`, `AuditLog`) has a `companyId` foreign key and an index on it. Every query against these models filters by `session.companyId` (see "Authentication & multi-tenancy" below). `Quotation`, `Activity`, and `Task` don't carry their own `companyId` — they're scoped transitively through their parent `Lead`.
- `Lead` is the hub: it links to `Customer` (who), `User` (owner), `Activity` (timeline), `Task` (follow-ups/reminders), and `Quotation` (money). `priority`, `product`, and `quantity` were added in Phase 2 to support the leads table's required columns — everything else reuses the Phase 1 schema unchanged.
- `Quotation` gained `nextAction`, `wonAt`, `lostAt`, `lostReason` in Phase 3 — the same "what's next" pattern as `Lead`, but scoped to the quotation. The `QuotationStatus` enum itself was intentionally left unchanged (`DRAFT`/`SENT`/`FOLLOWED_UP`/`ACCEPTED`/`REJECTED`/`EXPIRED`); the user-facing labels Draft/Sent/Negotiating/Won/Lost/Expired are a display mapping (`QUOTATION_STATUS_LABEL` in `quotationRisk.ts`), and "Follow-up Due" is never stored — it's derived from `followUpDate` vs now, exactly like lead overdue-ness.
- **Quotation and Lead status are intentionally not coupled.** Marking a quotation Won/Lost does not change the linked Lead's status automatically — the user does that separately on the Lead. This avoids surprising cross-entity side effects; the two are related but distinct funnel stages.
- `Activity` is an append-only timeline (calls, emails, notes, status changes) and belongs to `Lead`, not `Quotation` — there is no separate quotation-level activity log. Quotation actions write their `Activity` row onto the linked Lead (prefixed with the quotation number, e.g. `[QT-2026-0041] Quotation marked as sent.`), which is both how "quotation actions also appear in the lead's timeline" is satisfied and how quotation-level staleness is tracked (a quotation's own `updatedAt` timestamp, bumped by every action including notes, is what "no recent activity" measures).
- `Task` represents scheduled follow-ups, distinct from `Lead.nextAction`/`nextActionDeadline` (which is the single "what's next" field the core rule checks). A lead can have historical/multiple tasks; the core rule only cares about the live next-action fields on the lead itself.
- `Customer` gained `contactPerson` in Phase 4 — the only schema change that phase needed. Customer status and repeat-order signal are **not** columns; they're computed on every read from the customer's leads (see Risk logic below), consistent with how lead/quotation risk already works. This was a deliberate choice to keep them from ever drifting out of sync with the underlying data.
- SQLite has no native enum type — Prisma stores enums as `TEXT` with a check constraint. This is invisible in application code and will map cleanly to real enums on Postgres later.
- `IngestionBatch`/`IngestionRecord` (Phase 7) are the universal ingestion audit trail — one `IngestionBatch` per ingestion event (a CSV upload, a manual add, a webhook delivery), with one `IngestionRecord` per normalized enquiry underneath, whatever its outcome (`CREATED`/`DUPLICATE`/`INVALID`), linking to the `Lead`/`Customer` it produced if any. Both are `companyId`-scoped like every other tenant model. `Integration` gained `enabled`/`lastSyncAt`/`lastSuccessAt`/`lastError` in Phase 7, ahead of any connector actually using them.
- `Integration` gained `webhookToken` (unique, nullable — the secret URL segment identifying a company's webhook; null until an Owner/Manager sets one up), `signingSecret` (unique-in-practice, optional HMAC key), and `totalReceived` in Phase 8. `IntegrationStatus` gained `TEST_MODE`. "Disabled" is deliberately **not** a stored status value — it's computed from `enabled: false` at display time (`IntegrationStatusBadge`'s `enabled` prop overrides whatever `status` says), so there's exactly one source of truth for on/off rather than two fields that could drift apart.
- `FailedIngestion` (Phase 8) is a distinct, actionable work queue — not the same thing as `IngestionRecord(status: INVALID)`, which is a read-only audit row. It holds the raw payload, the normalized payload if the adapter got that far, the error, and a retry count, so a human can inspect, correct, and retry, or dismiss. `companyId`-scoped like everything else.
- `Company` (Phase 10) gained `onboardedAt` (`DateTime?` — null means a new company hasn't finished, or skipped, the onboarding wizard yet; every seeded demo company has it backfilled so they're never routed there) and six workflow-settings fields: `highValueThreshold`, `staleQuotationDays`, `defaultFollowUpDays`, `defaultPriority`, `lostReasonPresets` (JSON-string array), `activeLeadSources` (JSON-string array of `LeadSource` values) — SQLite has no native array type, so the two list fields are stored as JSON strings and parsed at the edges (server actions write `JSON.stringify`, pages read with `JSON.parse`). Deliberately a short, fixed list of levers, not a general-purpose settings table or a workflow builder.
- `AiInsight` (Phase 9) is cached, structured AI output — never a source of truth for anything (the deterministic `src/lib/*Risk.ts`/`customerIntelligence.ts` logic remains that). One row per `(companyId, kind, entityType, entityId)` — `@@unique` on exactly those four columns, so a regenerate is an upsert, not a growing history. `sourceVersion` is a cheap composite fingerprint (timestamps/counts of the data that fed the last generation); a cache hit on an unchanged fingerprint skips the AI call entirely. `AiUsageLog` is separate and append-only (one row per call attempt, mocked or real, success or fail) — usage history is deliberately never conflated with the cached content itself.

## Mutation pattern

All writes go through Next.js **server actions** in `src/server/actions/`, called directly from client components (no hand-rolled `fetch`/API routes for internal CRUD — this remains true post-auth, so there is no separate REST/API surface to independently secure). Every action starts with `const session = await requireSession();` and then re-derives the target record scoped by `session.companyId` before doing anything else — the mutation surface is small and centralized both for the pre-existing reason (the core business rule must be enforced consistently everywhere a lead can be edited) and for tenant isolation (there's exactly one place per entity type where "does this record belong to me" is checked, not one per form). Each action revalidates the affected paths so server components re-fetch fresh data.

## Risk logic

`src/lib/leadRisk.ts` and `src/lib/quotationRisk.ts` are the two functions that decide whether a lead or quotation needs attention, Won/Lost-exempt. Every page that lists or details leads/quotations — plus the dashboard's `metrics.ts` — imports these rather than re-deriving the logic; if a rule changes, it changes in one place. `metrics.ts`'s "Money at Risk" total deliberately dedupes *within* the lead-side and quotation-side buckets (a lead that's both untouched and missing a next action is only counted once) but does **not** dedupe a lead against its own quotation — a known simplification noted as technical debt below.

Both functions' value/staleness thresholds (Phase 10) are **optional parameters defaulting to their original Phase 1–3 hardcoded values** (`getLeadRisk(lead, now, highValueThreshold?)`, `getQuotationRisk(quotation, now, { highValueThreshold?, staleDaysThreshold? })`) — so every pre-Phase-10 call site kept compiling and behaving identically without being touched, and only the call sites that fetch a company's configured thresholds (via `getCompanyRiskThresholds()`) opt into using them.

`src/lib/customerIntelligence.ts` follows the same pattern for customers: `computeCustomerStatus` and `computeRepeatOrderSignal` are pure, rule-based functions (explicitly no AI/ML — the repeat-order signal is average-interval-vs-time-since-last-order arithmetic) that `src/server/data/customers.ts` calls after fetching a customer's leads. Because the signal is a genuine estimate rather than a certainty, every place it's surfaced in the UI (customer detail's Repeat-Order Signal card, the Customers list badge, the dashboard's Repeat Revenue Opportunities section) carries copy that frames it as an opportunity signal to check, not a prediction to trust blindly.

`src/lib/taskRisk.ts` extends the same family to tasks (Overdue/Due Today/Upcoming/Completed). It replaced a near-identical `statusOf()` that used to live only inside the lead detail page's Follow-ups card — that card was refactored in Phase 5 to import the shared version instead, per the "centralize escalation logic" rule.

## Notifications

`src/server/data/notifications.ts`'s `syncNotifications` generates real `Notification` rows from the same lead/quotation/customer/task risk logic every other page already computes — it does not invent a second definition of "at risk." It's called from `getNotificationsForUser` (used by both the header bell and the dashboard's unread count) before every read, so notifications are always current without a background job or cron.

Because `syncNotifications` can be invoked from more than one place in a single request, a naive "check if an unread one exists, then create" is racy — two concurrent calls can both see "none exists" and both insert. This is enforced correctly, not just avoided by convention: `Notification` has a DB-level `@@unique([companyId, type, entityType, entityId, userId])` constraint, and the insert path catches the resulting P2002 conflict as a no-op. `syncNotifications` is also wrapped in React's `cache()` so redundant work within one request is avoided in the common case — the DB constraint is what makes it *correct*, the cache is what makes it *cheap*. Each notification is a "slot" per (condition, recipient): marking one read and having the same condition still be true later resurfaces it (fresh `createdAt`), rather than growing an unbounded history of rows for a persistent issue.

## Ingestion architecture

Every lead source — manual entry, CSV rows, and eventually real connectors/webhooks — funnels through one function: `ingestLead()` in `src/server/ingestion/pipeline.ts`. Nothing writes to `Lead` or `Customer` any other way. The pipeline is: validate (`validate.ts`) → detect duplicate (`duplicates.ts`) → find-or-create the customer → create the lead (unassigned unless a salesperson was explicitly chosen) → write an `Activity` note → notify the assigned owner if any → record an `IngestionRecord`. This is what makes the source-independence real: a connector built in a later phase only has to produce a `NormalizedLeadInput` (source, customer identity, contact details, requirement, product, quantity, value, optional external ID) — it never needs its own create-customer or create-lead logic.

**Duplicate detection is two-tier, both non-destructive.** "Exact" (same `source` + `externalLeadId` already recorded in `IngestionRecord`) is always blocked with no override — this only applies to sources with a stable external ID, so it's inert for manual/CSV today but ready for a connector that has one. "Possible" (the matched customer, by normalized phone or email, already has an active lead opened in the last 3 days) is surfaced as a decision, never auto-resolved: manual entry shows an inline "Possible Duplicate — create anyway?" prompt; the CSV wizard flags the row and leaves it unchecked by default in the preview, importable if the user opts in via `forceCreateDespitePossibleDuplicate`. Neither tier ever merges records automatically. A returning customer with an *older or already-closed* lead is deliberately not flagged — repeat enquiries over time are normal, not duplicates.

Customer matching (`findOrCreateCustomer` inside `pipeline.ts`) is find-or-update, not find-or-replace: a matched existing customer only has its *missing* fields filled in from the new enquiry (phone, email, city, state, company name), never overwritten. Matching itself is in-memory (`src/lib/contactMatch.ts`'s `normalizePhone`/`normalizeEmail` compared against the company's customers) rather than a DB fuzzy-match — deliberately simple, and correct at the scale a local per-company customer list actually is.

**CSV import never trusts the client for correctness.** `src/lib/csv.ts` (hand-rolled parser — quoted fields, embedded commas/newlines, ragged rows all degrade gracefully rather than crashing) and `src/lib/csvMapping.ts` (synonym-based column auto-mapping, free-text source/date/currency parsing) run entirely client-side so the Upload → Map → Preview & Validate steps are instant and offline. But the Preview step's "valid"/"duplicate"/"invalid" classification is UX only: the actual Import step sends the mapped rows to `importCsvLeads()`, which re-validates and re-checks duplicates for every row through the exact same `ingestLead()` path manual entry uses, tenant-scoped to the caller's `session.companyId`. One consequence worth knowing: because rows are ingested sequentially and duplicate-checked against the live database, two rows in the *same* CSV batch describing the same new customer are caught too — the second row's check runs after the first row's lead already exists — without any separate in-batch-dedup logic being needed server-side (the wizard does still do a lightweight in-file check for the *preview*, so the user sees the flag before confirming, not just after).

## External integration architecture

Phase 8 adds one real API route — `POST /api/webhooks/[provider]/[token]` — everything else in the app is still server actions. The route file itself is intentionally almost empty; all logic lives in `src/server/ingestion/webhookHandler.ts` and the connector adapters, per the phase's "keep handlers thin, put provider logic in adapters" instruction.

**Company resolution is token-only, never URL-guessable.** `[provider]` picks the adapter (a lookup, not a trust boundary); `[token]` is a random 24-byte hex string (`generateWebhookToken()`) stored on exactly one company's `Integration` row. `prisma.integration.findFirst({ where: { webhookToken: token, type: adapter.type } })` is the entire tenant-resolution step — there is no company id anywhere in the request. This makes "Company A's token used against Company B" structurally impossible rather than merely checked: the token doesn't name a company at all, it *is* the company, so there's nothing to spoof. An unknown or wrong-provider token returns the same generic 404 as a nonexistent one — never enough information to confirm a token's existence.

**The pipeline, extended for external delivery:**
External Source → webhook route (`route.ts`) → `handleWebhookRequest()` (rate limit → token resolve → signature check) → `processProviderPayload()` (parse via adapter → `ingestLead()` → record outcome) → `IngestionBatch`/`IngestionRecord` (as in Phase 7) → `FailedIngestion` if it couldn't become a lead. `processProviderPayload()` is the shared core — the real webhook route and the authenticated in-app "Send Test Payload" console both call it, so a test payload exercises the identical code path a real delivery would, not a simulation of it.

**Provider adapters** (`src/server/ingestion/connectors/`) implement one interface: `parse(rawPayload) → NormalizedLeadInput | error`, plus a `samplePayload()` for the test console. The IndiaMART adapter is built against their documented lead-push field names — it has never talked to a live account, since no credentials/access were provided (per the phase's explicit instruction not to fake a live connection); the Integrations page always labels it **Test Mode / Credentials Required**, never Connected. The Website Forms adapter matches the payload the public demo form actually sends, and *is* allowed to show Connected once configured — unlike IndiaMART, there's no missing credential here, submitting the real form really does create a real lead. The email adapter (`email.ts`) is prepared but not wired to any route (see below).

**Webhook security** (`src/server/ingestion/security.ts`) covers what the phase asked for as available-but-not-all-mandatory concepts: HMAC-SHA256 signature verification (`verifyHmacSignature`) is applied only when the integration has a `signingSecret` configured — neither IndiaMART's real API nor a browser-submitted form can meaningfully sign a request, so this is "supported where a provider supports it," not forced on connectors that can't. Timestamp freshness (`isTimestampFresh`) and a per-token in-memory sliding-window rate limiter (`checkRateLimit`, 60 req/min) are both implemented and wired into the webhook path. The rate limiter is the one piece of this that doesn't survive horizontal scaling — it's an in-process `Map`, fine for a single local dev server, and would need a shared store (Redis) behind multiple instances. Secrets never reach client code: `webhookToken` is shown in full (it's meant to be copied into the URL), but `signingSecret` is returned in plaintext exactly once, at generation time, and masked as `••••••••` on every subsequent read — the database is the only place it's stored in full.

**Idempotency.** Exact duplicates (same `source` + `externalLeadId` already in `IngestionRecord`) are blocked unconditionally by the Phase 7 duplicate logic reused as-is — a provider retrying the same delivery after a timeout is a safe no-op, not a second lead. "Possible" duplicates (same customer, very recent open lead, no external id involved) use the same 3-day-window heuristic Phase 7 established; a webhook has no human to ask "create anyway?" mid-request, so it's simply not created and logged as `DUPLICATE` — visible in Import History, not silently dropped.

**Failed ingestion, never silent.** Three ways a webhook delivery can fail to become a lead — malformed JSON, an adapter that can't map the payload, or `ingestLead()`'s own validation rejecting it — all land in `FailedIngestion` with the raw payload, the normalized payload if one was produced, and the error. Nothing is ever just discarded. `/settings/integrations`' Failed Ingestion Queue lets an Owner/Manager inspect the raw data, fill in whatever `validate.ts` actually requires (customer name, at minimum) via a small correction form, and retry through the same `ingestLead()` pipeline — or dismiss it as genuinely not actionable. A successful retry sets `status: RESOLVED` and records the resulting lead id; a failed retry increments `retryCount` and stays `PENDING`.

**Email ingestion preparation** (`src/server/ingestion/connectors/email.ts`, `emailFixtures.ts`) is architecture only — a normalization function and mock payloads, no route, no Gmail OAuth, not in `registry.ts`. It exists so a real inbox connector later has a `NormalizedLeadInput` target to build against instead of inventing one under time pressure; per the phase's instruction, nothing here is reachable from outside the codebase.

**Monitoring** is intentionally minimal per-connector state, not a metrics system: `totalReceived` (every attempt, success or fail), `lastSyncAt` (last attempt), `lastSuccessAt` (last time a lead was actually created — untouched by duplicates or failures), `lastError` (cleared on the next success). `getIntegrationsForCompany()` derives a simple `health: "healthy" | "error" | "unknown"` from those two fields rather than storing a fourth one that could disagree with them.

## AI intelligence architecture

Every AI feature calls one function — `generateStructured()` in `src/server/ai/client.ts` — never a provider directly. That function makes exactly one of two things happen:

1. **No provider configured** (`ANTHROPIC_API_KEY` unset): the feature's own `mockResult(input)` runs immediately, synchronously, no network call. This is development/test mode. It is always flagged `mocked: true`, the UI always shows a "Dev Mode" label and a "development mode — not a real AI response" footnote, and it is never allowed to be mistaken for a real answer.
2. **A provider is configured**: a real call is attempted — `provider.generateJSON()` under a timeout (`withTimeout`, default 20s), then `extractJson()` pulls a JSON object out of output that may be wrapped in prose or a ` ```json ` fence, then `validateObject()` checks it field-by-field against the feature's declared `ObjectSchema`. **Any** failure at any of those steps — timeout, network error, non-JSON output, a missing required field, an invalid enum value — returns `{ ok: false, error }`. This is the one rule that matters most here: a configured-but-failing provider never silently falls back to mock data. Mock mode is *only* entered when nothing is configured at all; a real failure is always surfaced as a real, honest failure, with a plain "AI summary unavailable right now" state in the UI. This was verified directly: pointing `AnthropicProvider` at an invalid API key produces a clean `401 → {ok:false}` result, not a disguised mock answer.

Every call — either branch, success or failure — writes one `AiUsageLog` row (`feature`, `provider`, `mocked`, `success`, `latencyMs`, `errorMessage`). This is the entire "cost control" mechanism beyond caching: no token/dollar accounting, just enough to see call volume and failure rate per company.

**Provider abstraction.** `AIProvider` (`src/server/ai/types.ts`) is two methods: `isConfigured()` and `generateJSON({system, prompt, maxTokens})`. `AnthropicProvider` (`providers/anthropic.ts`) is the only implementation, talking to Anthropic's Messages API over a plain `fetch` call (no SDK dependency for one HTTP request, consistent with this project's minimal-dependency pattern elsewhere). Nothing outside `client.ts`'s `getActiveProvider()` references `AnthropicProvider` by name — adding a second provider and choosing between them by config is a change to one function, not a refactor.

**Four features, one pattern each** (`src/server/ai/features/`): a typed `Input`, an `ObjectSchema`, a `buildPrompt(input)`, and a `mockResult(input)` that's deterministic and derived from the *same* input the real prompt would see (never hardcoded filler text) — so the mock path is genuinely useful for testing UI states, not just a placeholder. `leadInsights.ts` deliberately bundles the summary, the advisory priority signal, and the next-action suggestion into **one** generation rather than three separate ones — they all need the same lead context, so one call is both cheaper and keeps the three outputs mutually consistent.

**Caching** (`src/server/data/ai.ts`, the `AiInsight` model): every cache-backed feature (`getLeadInsights`, `getCustomerInsights`, `getSalesBrief` in `src/server/actions/ai.ts`) computes a `sourceVersion` — a cheap string built from timestamps/counts of the data that would feed a fresh generation — and compares it against the cached row's before calling `generateStructured()` at all. A page view that finds a fresh cache never spends an AI call; the manual Regenerate button always forces one via a `force: true` parameter, and always overwrites the cache (an `upsert` on the model's `@@unique([companyId, kind, entityType, entityId])`). Detail pages (`leads/[id]/page.tsx`, `customers/[id]/page.tsx`, the dashboard) read the cache with a plain `getCachedInsight()` DB call on render — never an AI call on page load — so the initially-displayed content may be stale relative to the very latest edit, which is an accepted, clearly-timestamped tradeoff in exchange for never spending an AI call just because someone opened a page.

**Enquiry extraction has no cache** (`extractEnquiryFromText` in `server/actions/ai.ts`) — it's a one-off preview over whatever text a user just pasted, never persisted as an `AiInsight`. The AI-filled fields land in the *same* `AddLeadCard` form fields a manual entry would use, still fully editable, and only ever fill a field the user hasn't already typed something into (`applyExtraction()` in the component: `f.customerName || extracted.customerName`, never the reverse) — "human approval" is the existing review-then-submit form flow, not a separate confirmation step, and the actual lead creation goes through the unchanged Phase 7 `createManualLead` pipeline.

**The one and only path from an AI suggestion to a real change**: `approveNextActionSuggestion(leadId, actingUserId)` reads the cached `LEAD_INSIGHTS` content, computes a due date from `suggestedDeadlineDays`, and calls the *existing, unmodified* `scheduleFollowUp()` server action from `src/server/actions/leads.ts` (Phase 2) — creating a real `Task` and `Activity`, attributed to the human who clicked Approve. Nothing in the AI layer has its own write path to `Lead`, `Task`, `Quotation`, or `Customer`; every AI-adjacent mutation is a call to an action that already existed before Phase 9, unchanged.

**Tenancy.** Every feature's `Input` type is a hand-built, explicitly whitelisted digest — `title`, `product`, `status`, and so on, picked field by field from data already fetched via the existing tenant-scoped `getLeadDetail`/`getCustomerDetail`/`getDashboardData` — never a spread of a raw Prisma row. This is what makes "Company A data never reaches an AI provider mixed with Company B's" true by construction rather than by a runtime check: there is no code path where an unscoped or cross-company row could end up in a prompt, because the input-builder never touches a field it wasn't explicitly told to. The same discipline is why secrets (password hashes, session tokens, `Integration.webhookToken`/`signingSecret`) can never reach a prompt — none of those fields exist on the whitelisted input types in the first place.

**Ingestion enrichment is prepared, not activated.** `enrichIngestionInputWithAi()` (`src/server/ai/features/enrichIngestion.ts`) is wired into `ingestLead()` as its first step, but returns its input unchanged unless `AI_INGESTION_ENRICHMENT=true` is set — off by default, since none of Phase 9's actual sources (manual, CSV, IndiaMART, website form) need it; they already supply structured fields directly. When enabled, it only fills fields the source left blank (`input.product || result.data.product`, never the reverse) — a provider-supplied field can never be overridden by an AI guess.

## Authentication & multi-tenancy

Login is real: `src/server/actions/auth.ts`'s `login()` looks up the user by email, verifies the password with `verifyPassword()`, and — only if the user exists, is active, and the password matches — calls `createSession()`, which inserts a `Session` row and sets an httpOnly/sameSite/secure cookie holding the token. `getSession()` (wrapped in React's `cache()`) reads that cookie on every request, validates the token against the DB, and checks both expiry and `user.isActive`; any failure returns `null`. `requireSession()` calls `getSession()` and redirects to `/login` if it's null — this is what every page under `(app)/` calls first, via the group's shared `layout.tsx`.

**Tenant isolation is enforced at the query, not the UI.** Every data-fetching function and every server action takes (or derives from the session) a `companyId` and filters by it directly in the `where` clause — `findFirst({ where: { id, companyId } })` instead of `findUnique({ where: { id } })`, because `findUnique` can't accept extra non-unique filter fields. `Quotation` has no `companyId` column of its own, so it's scoped transitively: `findFirst({ where: { id, lead: { companyId } } })`. When a record isn't found under that filter — whether because it doesn't exist or because it belongs to a different company — the result is identical: a `ForbiddenError`, rendered as an ordinary "not found" page. A user manually editing a lead/customer/quotation/team-member ID in the URL to try another company's data gets the same "not found" experience as a typo'd ID, never a permission error that would confirm the record exists elsewhere.

Role checks live in `src/server/auth/permissions.ts` as small named functions (`canManageTeam`, `canManageCompany`, `getOwnerScope`) rather than inline `if (role === "OWNER")` scattered across pages — `getOwnerScope(session)` in particular returns the session's `userId` for a Salesperson (so list-page queries add an owner filter) and `undefined` for Owner/Sales Manager (no filter, full company visibility).

Session deletion is how "deactivate a user" becomes "log them out immediately," not just "block their next login": `setUserActive(userId, false)` deletes every `Session` row for that user in the same action that flips `isActive`, so an already-logged-in session dies on its next request rather than persisting until expiry.

## Audit logging

`AuditLog` is deliberately selective, not a general activity feed — that's what `Activity` (the lead timeline) already covers. It records business-changing events only, each written at the point of mutation in the relevant server action: lead owner change, quotation status change, lead Won/Lost, user created, user role changed, user activated/deactivated, company settings changed, company created, onboarding completed (Phase 10), integration configured/secret regenerated/enabled-toggled (Phase 10), failed ingestion retried/dismissed (Phase 10), and CSV import batch completed (Phase 10, one entry per batch, not per row). Every write includes `companyId` and the acting `userId`, and `metadata` (a JSON string) captures the before/after values where relevant (e.g. `{"from":"SENT","to":"NEGOTIATING"}`). Trivial, non-business-changing actions (opening a card, testing a webhook payload, a filter change) are deliberately never audited.

## Pilot readiness (Phase 10)

**Onboarding.** `OnboardingWizard.tsx` holds all 7 steps as client-side React state — nothing is written to the database until the user actually reaches the relevant step, so abandoning the wizard partway only persists whatever team members were already added (each is a real `createTeamUser` call with a generated temporary password, since a teammate account needs to exist immediately to be useful) plus nothing else. `saveOnboardingSettings()` writes company details + all workflow-settings fields together in one call when the wizard advances past the follow-up-defaults step; `completeOnboarding()` sets `onboardedAt` and is the only thing that ever unblocks the `(app)` layout's onboarding redirect. The wizard's final step folds "import CSV / add manually / skip" and "finish" into one screen — whichever choice the owner makes both completes onboarding and routes them to the right next page (`/leads/import`, `/leads`, or `/`), rather than making them click through a separate confirmation screen after already deciding.

**Sales Process Health** is intentionally the *only* place in the app with net-new query logic for Phase 10 (`src/server/data/health.ts`) — even it doesn't invent a new definition of "at risk": it re-filters the already-risk-attached output of `getLeadsForCompany`/`getQuotationsForCompany`/`getCustomersForCompany`, plus `getFailedIngestions` unchanged from Phase 8. The one genuinely new check is duplicate-risk customers, which groups a company's customers by normalized phone/email (reusing `src/lib/contactMatch.ts`, the same normalization the ingestion duplicate-checker uses) and flags any group with more than one member.

**Global search** (`src/server/actions/search.ts`) runs three parallel, independently tenant-scoped Prisma queries (customers, leads, quotations) rather than one denormalized search index — appropriate at the scale a single company's data actually is, and it means each result type can be scoped/shaped differently (e.g. leads and quotations also match through their linked customer's contact fields via a nested `OR`, something a single flat index would complicate). The client component debounces 250ms and treats "query shorter than 2 characters" as a pure render-time condition rather than a `setState` call inside the search effect, avoiding a React anti-pattern (adjusting state in response to a prop/state change instead of computing it during render).

**Reliability.** `(app)/error.tsx` is the boundary that matters most in practice, since nearly every page and mutation lives under that route group — it keeps the Sidebar/AppHeader chrome mounted (Next.js error boundaries replace only the segment they're nested under, not ancestor layouts) so a crash doesn't also lose navigation. The root `error.tsx`/`not-found.tsx` pair covers the public pages (`/login`, `/signup`) and any unmatched URL. Neither ever renders `error.message`/`error.stack` directly — only a generic message plus `error.digest` (a safe, non-identifying reference Next.js generates) for support correlation.

**Demo data reset** deliberately does not refactor `seed.ts` into an importable function — it already works, is a large standalone script with its own `PrismaClient` instance, and "don't rebuild working functionality" applies here too. Spawning it as a child process (`npx prisma db seed`) is a few lines instead of a risky refactor, and is safe specifically *because* the whole feature is hard-gated to non-production.

## Production readiness (Phase 11)

**Environment validation happens at server startup, not build time.** `src/lib/env.ts`'s `validateEnv()` is called from `src/instrumentation.ts`'s `register()`, which Next.js guarantees runs once when a server instance starts and never during `next build`. This split exists because of a real bug hit during development: an earlier version validated `DATABASE_URL` eagerly at the top of `src/lib/prisma.ts`, and `next build`'s "collecting page data" step imports/partially-evaluates route modules for pages that touch the database at render time (e.g. `/login`'s demo-account query) even when nothing is being served yet — the eager throw failed the build itself, not a real request. Moving the check to `instrumentation.ts` fixed this: `register()` still fails loudly (throws, refusing to serve traffic) if required config is missing **and** `NODE_ENV=production`, but never runs during a build.

**Structured logging** (`src/lib/logger.ts`) writes single-line JSON to stdout/stderr — no paid log aggregator, since Vercel (and most hosts) capture process output automatically. Five category helpers (`authFailure`, `databaseFailure`, `ingestionFailure`, `webhookFailure`, `aiFailure`) plus a generic `serverError`, each running values through a defensive key-based redaction pass (`password`, `token`, `secret`, `apikey`, etc. — case-insensitive) before logging, as a second line of defense beyond "only ever build `meta` from named whitelisted fields" (the same discipline already used for AI prompt inputs). `instrumentation.ts`'s `onRequestError` hook calls `logger.serverError` for anything that reaches Next.js as an uncaught error across Server Components, Route Handlers, and Server Actions — this is what actually caught and logged the real bug found during Phase 11's staging regression test (a follow-up scheduled with no due date threw `Error: Due date is required.` inside a Server Action; the error boundary showed a generic message with no stack trace, and `vercel logs` showed the exact structured log line with full context and zero secrets — see ROADMAP.md's Phase 11 entry).

**Rate limiting** (`src/lib/rateLimit.ts`) is the same in-memory sliding-window mechanism Phase 8 built for webhooks, generalized (moved out of `src/server/ingestion/security.ts`, which now holds only webhook-specific concerns — HMAC verification, timestamp freshness) and reused by `login()`/`signup()` in `src/server/actions/auth.ts`. Same caveat as before: correct behavior on a single warm server instance, doesn't share state across concurrent instances — acceptable for a pilot-scale deployment, would need Redis to survive real horizontal scaling.

**Security headers** (`next.config.ts`) are applied via two `headers()` rules rather than one: a strict rule (CSP, `X-Frame-Options: SAMEORIGIN`) matched against `/((?!website-form).*)` — a negative-lookahead path pattern that excludes the public, deliberately-embeddable `/website-form/[token]` page — and a second, unconditional rule (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) applied everywhere including that page. The CSP itself skips nonces on purpose: nonce-based CSP requires every page to be dynamically rendered (no static optimization), which buys nothing here since the app is already all-dynamic behind `requireSession()`, but nonces would still add proxy/middleware complexity for zero marginal benefit — `'unsafe-inline'` for script/style is the documented Next.js fallback and matches what the framework itself injects for hydration.

**`GET /api/health`** (`src/app/api/health/route.ts`) runs one `SELECT 1` through the same Prisma client the app uses and returns only `{status: "ok" | "error"}` — deliberately nothing else, so it can be pointed at by an uptime monitor without that monitor ever seeing anything sensitive.

**Deployment model**: Vercel, deployed via CLI directly from the local filesystem (`vercel link` + `vercel deploy --prod`) rather than a connected GitHub repository — no CI/CD pipeline exists yet, deploys are manual. `.vercelignore` explicitly excludes `.env`/`.env.local`/`.env.*.local`, because `vercel deploy`'s upload step does **not** reliably honor `.gitignore` for env files the way `git` does — it uploads them and only warns ("Detected .env file, it is strongly recommended to use Vercel's env handling instead") rather than refusing. This was caught during the first real deployment (a 3.1MB upload including the local `.env` with real Supabase credentials; fixed and redeployed at 435B with no warning) — see DEPLOYMENT.md for the full incident and the general rule it implies for any future env-adjacent tooling change.

## Local dev workflow

```bash
npm run dev                 # start the app at http://localhost:3000, opens to /login
npx prisma migrate dev      # create/apply a migration after editing schema.prisma
npx prisma db seed          # reset sample data (two companies, passwords included) — refuses to run if NODE_ENV=production
npx prisma studio           # inspect the PostgreSQL database visually
```

Requires a real PostgreSQL `DATABASE_URL`/`DIRECT_URL` even for local dev — see DEPLOYMENT.md for Supabase setup. Demo accounts (all companies, password `password123`) are listed on `/login` itself when `NODE_ENV !== "production"`.

AI features run in development/mock mode automatically — no setup needed. To activate the real provider, set `ANTHROPIC_API_KEY` in `.env` (and optionally `AI_MODEL`, default `claude-sonnet-5`); every AI surface starts making real calls on the next request, no code change required. The staging deployment deliberately leaves this unset.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full environment-variable reference, Vercel deployment steps, migration/seed commands, and common failure modes.
