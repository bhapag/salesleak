# SalesLeak — Product Spec

SalesLeak is a product of NobleArc Technologies (customer-facing: "SalesLeak by NobleArc"). See [BRAND.md](BRAND.md) for the full brand hierarchy and usage rules — inside the product itself, SalesLeak remains the primary, visible brand; NobleArc appears only as a small secondary endorsement.

## What it is

SalesLeak is sales-management software for small B2B manufacturers, distributors, traders, and industrial businesses. It gives a business owner one place to see every sales enquiry, where it came from, who owns it, what's supposed to happen next, and whether anything is at risk of being forgotten.

## The problem

Enquiries, quotations, and follow-ups arrive from many disconnected channels and get lost in inboxes, WhatsApp threads, and memory. Deals go cold not because they were lost on merit, but because nobody followed up in time.

## The core rule

**Every active lead must have an owner, a status, a next action, and a deadline.**

"Active" means not Won and not Lost. If any of the four is missing, the lead is flagged as requiring attention — this is not optional polish, it is the product's central mechanism. Won and Lost leads are exempt (there is nothing left to act on).

## The value proposition

**See which leads and quotations are at risk before revenue is lost.**

Everything in the product — dashboards, list views, badges, filters — exists to answer one question fast: *which of my deals need a human to act right now?*

## Lead sources and ingestion

- CSV/Excel import, Manual entry, IndiaMART (**Test Mode**), and Website Forms (**Connected**) — working today. All four go through the same universal ingestion pipeline every source uses: normalize → validate → detect possible duplicates → create or update the customer → create the lead → notify.
- IndiaMART is explicitly labeled **Test Mode / Credentials Required** — the connector architecture is real and testable end to end, but no live IndiaMART account is connected. Going live is entirely an action on the business's own IndiaMART seller account (pointing their Push API's "Integration URL" at SalesLeak's existing webhook URL), not a value SalesLeak needs to be given — see the Integrations page's IndiaMART checklist for the exact, IndiaMART-documented steps. Website Forms is genuinely live: submitting the real public form creates a real lead.
- Justdial, ExportersIndia, TradeIndia, WhatsApp, Gmail — still **Coming Soon**. No live API is connected for any of these yet.
- Phone calls and referrals are logged as a source choice on manual entry, not separate connectors.

Every enquiry, regardless of source, becomes an ordinary `Lead` — SalesLeak does not have a separate "unprocessed enquiry" inbox. External data that can't become a valid lead (malformed, missing required fields) is never silently discarded — it lands in a Failed Ingestion Queue an Owner or Sales Manager can inspect, correct, and retry. See [ARCHITECTURE.md](ARCHITECTURE.md) for the ingestion and webhook-security architecture and [ROADMAP.md](ROADMAP.md) Phases 7–8 for what's built.

## Company workspaces & user roles

SalesLeak is multi-tenant: every authenticated user belongs to exactly one `Company`, and all business data (leads, quotations, customers, tasks, products, notifications, audit logs) is scoped to that company. A company's users never see another company's data, under any path — dashboard, list, detail URL, or server action. This isolation is enforced server-side, not by UI filtering; see [ARCHITECTURE.md](ARCHITECTURE.md).

- **Owner** — full visibility across the business: every salesperson's leads, quotations, and customers; team management (add/edit/deactivate users, change roles); company settings and sales workflow configuration; completes onboarding for a new company.
- **Sales Manager** — sees and manages the whole team's leads, quotations, tasks, and customers (same data scope as Owner); can reassign leads; can view Sales Process Health and Integrations; cannot manage company settings, workflow configuration, or team membership.
- **Salesperson** — primarily works My Day: their own assigned leads, tasks, and quotations, and the customers relevant to those leads. Cannot see Team, Company Settings, Sales Process Health, or Integrations pages — and, as of Phase 15, the Dashboard applies the same scoping: a Salesperson's home page reflects only their own numbers, with no company-wide Team Snapshot section.

Authentication is real (hashed passwords, server-side sessions). A new company signs up at `/signup` (creates the Company and its Owner) and is walked through a skippable onboarding wizard before reaching the dashboard. As of Phase 11, this runs on a real staging deployment (Vercel + PostgreSQL) — see [ROADMAP.md](ROADMAP.md) Phases 6, 10, and 11 — though still no email invitations and no custom domain yet.

## Subscription & billing

Every company has a subscription (Owner-only, `/settings/billing`): a new signup gets a **14-day free trial** with full functionality, shown as a days-remaining banner across the app. If a trial lapses without upgrading, the workspace becomes **read-only** — every salesperson keeps seeing their data exactly as it was, but can no longer create or edit leads, quotations, or follow-ups until the Owner reactivates. Data is never deleted, and export always keeps working, specifically so nobody's business records are ever held hostage by a billing lapse. Three plans exist (Starter, Growth, and a directly-assigned Founding tier for our first pilot customers) with simple, transparent, centrally-configured pricing — no hidden tiers, no fake enterprise pricing. Billing runs on Stripe behind a provider abstraction; until a real Stripe account is connected, the Billing page honestly shows itself as not-yet-connected rather than faking a checkout. See [ARCHITECTURE.md](ARCHITECTURE.md) and [ROADMAP.md](ROADMAP.md) Phase 14 for how this is enforced and what activating real billing requires.

## Getting a new company set up

Signing up creates a Company and its Owner, then walks the Owner through onboarding: company details, add teammates, sales workflow basics (high-value threshold, default priority, common lost reasons), lead sources currently used, follow-up defaults, and bringing in existing leads (CSV import, manual entry, or skip). Every step but company details can be skipped — a real business shouldn't have to configure things it doesn't have an answer for yet in order to start using the product. None of the not-yet-live integrations (Justdial, ExportersIndia, TradeIndia, WhatsApp, Gmail) are ever required during onboarding.

The handful of workflow settings gathered during onboarding (high-value opportunity threshold, quotation overdue threshold, default follow-up window, default lead priority, common lost reasons, lead sources used) stay editable afterward from Company Settings — SalesLeak deliberately keeps this to a short, fixed list of levers rather than a general workflow builder, and they directly change what the risk logic flags as needing attention, not just cosmetic labels.

## Sales Process Health

A dedicated page (Owner + Sales Manager) for spotting sales-*data* problems before they cost a deal — not a technical/server-health page. It surfaces: leads with no owner, no next action, or no deadline; quotations with no follow-up scheduled; customers with incomplete contact information; possible duplicate customer records; and failed ingestions — each with a real count and a direct link to the affected records. A global search (header, Ctrl/Cmd+K) finds any customer, lead, or quotation by name, company name, phone, or email, always scoped to the searcher's own company.

## Pilot readiness & data export

A separate, Owner-only **Pilot Readiness** page (`/settings/pilot-readiness`) is a setup-completeness checklist, not a data-quality monitor — is the sales team added, are lead sources configured, are workflow settings customized, is at least one connector set up — alongside a few of the same operational counts Sales Process Health already tracks (unassigned leads, failed ingestions, overdue follow-ups), so a brand-new Owner has one place to confirm the workspace is actually ready to run on before relying on it day to day.

An Owner can also export the company's **customers, leads, and quotations as CSV** from Company Settings — for the business's own records or backup, not a full data-portability/restore system. Every export is scoped to the exporting company only.

## What "at risk" means

A lead is flagged when any of these is true (and it is still active):

- Missing owner (unassigned)
- Missing next action
- Missing next-action deadline
- Next-action deadline has passed (overdue)
- Not yet contacted since creation (untouched)

Lost leads always carry a mandatory lost reason so patterns in why deals are lost become visible over time.

## Repeat revenue

SalesLeak's funnel doesn't end at Won — it continues: **Enquiry → Contact → Requirement → Quotation → Follow-up → Negotiation → Won/Lost → Repeat Order.** A won deal is a customer relationship, not just a closed ticket, and B2B industrial buyers tend to reorder on a cadence (consumables, spares, recurring production inputs). Missing that reorder window is lost revenue just as much as a forgotten follow-up is.

Repeat-order detection is a **simple, rule-based estimate** — not AI, not a guarantee. For a customer with 2+ historical won orders, SalesLeak estimates the average time between those orders and compares it to how long it's been since the last one, producing a signal (Normal / Due Soon / Repeat Order Due / Overdue-Dormant). It is always presented as an opportunity signal to go check on, never as a certainty.

A quotation and its linked lead can be closed independently — a won or lost quotation never *automatically* closes the lead, since a lead can carry more than one quotation and losing one shouldn't silently declare the whole opportunity dead. Closing a quotation offers an explicit, unchecked-by-default "also mark the lead Won/Lost" option; marking a lead Lost this way is only ever offered when no other quotation on that lead is still open.

## Customer status

Every customer is bucketed into one of five states, derived from their leads (never manually set, so it can't drift from reality):

- **Prospect** — enquired, never won a deal yet.
- **Active Customer** — has won exactly one deal.
- **Repeat Customer** — has won two or more deals.
- **Dormant** — has won at least one deal before, but has no currently active lead and hasn't been touched in 60+ days.
- **Lost** — every lead ever raised for them ended in Lost, none won, nothing currently active.

This is intentionally a separate, coarser concept from the repeat-order signal above: a customer can be a healthy "Repeat Customer" who just isn't due for their next order yet, or a "Dormant" customer worth checking on regardless of order cadence.

## AI assistance

SalesLeak uses AI to reduce manual work and help a salesperson understand an opportunity faster — never as a replacement for the deterministic rules above, and never to act on its own. Every AI feature is optional (a user clicks Generate), clearly labeled as AI-assisted, and advisory only:

- **Enquiry extraction** — paste a messy enquiry ("hi sir ravi this side need 5 ton gp material...") and AI pre-fills the Add Lead form's fields. It never invents information that isn't in the text — an unmentioned field stays blank — and the user reviews and edits every field before the lead is actually created.
- **Lead Insights** (on Lead Detail) — a short factual summary, an advisory priority signal (High potential / Medium potential / Low information / Urgent attention, always with a one-sentence reason), and a suggested next action. Approving the suggestion schedules it as a real follow-up task — the one and only way an AI suggestion becomes a real change, and only after a human clicks Approve.
- **Customer Summary** (on Customer Detail) — a short read of the relationship: what they buy, won/lost history, repeat-order behaviour, and any outstanding action worth flagging.
- **AI Sales Brief** (on the Dashboard) — a few bullet lines on today's biggest risks and opportunities, built from the same figures already shown in Money at Risk. Supplementary, never a replacement for those deterministic numbers.

AI never sets pricing, sends a quotation or message, marks a lead Won/Lost, reassigns a salesperson, merges customers, or deletes anything — the core rule (Owner + Status + Next Action + Deadline) and every existing workflow stay exactly as they were. If no AI provider is configured, a clearly-labeled development-mode fallback keeps every AI surface testable without ever pretending to be a real AI response; the rest of SalesLeak works identically either way. See [ARCHITECTURE.md](ARCHITECTURE.md) for the provider abstraction and [ROADMAP.md](ROADMAP.md) Phase 9.

## Explicitly out of scope for now

Live credentials/API access for IndiaMART, and any real connection at all to Justdial/ExportersIndia/TradeIndia/WhatsApp/Gmail, autonomous AI actions (messaging, calling, quotation sending, pricing decisions), a real connected Stripe account (the billing *architecture* is built as of Phase 14 — see above — but no live payments have been taken), a custom domain, and ERP/accounting/inventory features. These are deliberately deferred — see [ROADMAP.md](ROADMAP.md). (As of Phase 11, SalesLeak *does* run on real production infrastructure — PostgreSQL + Vercel — just not yet with a paid AI provider, live connector credentials, live billing, or a custom domain.)

Integrations exist only to make enquiry capture easier — SalesLeak's value stays in surfacing which of those captured enquiries need action before revenue is lost, not in how many sources feed it.

## Launch readiness

As of Phase 15, the product itself, its security posture, and its data-safety story are launch-ready — the complete signup-to-Won-deal funnel, including the core rule, trial/read-only enforcement, and role-based access, was verified live end-to-end on a real signup, not just the seeded demo data. What remains before a first real customer is fully onboarded is a short list of business decisions rather than code: a support contact channel, Terms of Service/Privacy Policy (neither exists yet — deliberately not drafted speculatively), and, only if that customer needs them, a live IndiaMART seller-account connection or a live Stripe account. See [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) for the complete, honestly-marked breakdown.
