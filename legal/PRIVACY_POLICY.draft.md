# SalesLeak — Privacy Policy

> **DRAFT — NOT YET EFFECTIVE. NOT LEGAL ADVICE.**
>
> Every category below was traced against SalesLeak's actual Prisma schema,
> authentication code, logging, and deployed environment variables on
> 2026-09-09 at HEAD `3dbbd47`. Nothing here is copied from a template, and
> nothing is claimed that the code does not do.
>
> It has **not** been reviewed by a lawyer. Resolve every
> `[DECISION REQUIRED: …]` marker before publishing. See
> [DECISIONS_REQUIRED.md](DECISIONS_REQUIRED.md).

---

## 1. Who we are

SalesLeak is operated by [DECISION REQUIRED: LEGAL ENTITY] ("we", "us"). The
Service is presented as "SalesLeak by NobleArc".

Contact for privacy questions: **salesleak.support@gmail.com**

**Grievance Officer:** [DECISION REQUIRED: GRIEVANCE OFFICER NAME AND CONTACT]

Researched, so this is no longer an open question: under the DPDP Rules 2025
every Data Fiduciary must appoint a Grievance Officer and publish the contact.
It can be any competent person in the organisation. A **Data Protection
Officer is not required** — that obligation applies only to Significant Data
Fiduciaries, and does not commence until 13 May 2027. Do not claim a DPO
exists.

## 2. Two different kinds of people

This matters for understanding the rest of this policy.

**Users** — the people at a subscribing business who sign in to SalesLeak. We
decide how their account data is handled, so for them we are the controller.

**Contacts** — the customers, leads and enquirers whose details a subscribing
business enters into its own workspace. **We do not choose that data or decide
why it is collected.** The subscribing business does, and it is responsible for
having a lawful basis to hold it. We process it on that business's behalf.

If you are a Contact and want your details corrected or removed, contact the
business you dealt with. If you reach us instead, we will pass the request to
that business.

## 3. What we actually collect

### From Users (people who sign in)

| Data | Why |
|---|---|
| Name, email address | Identify the account, show who did what |
| Password | Stored only as a **scrypt hash** — never in readable form, and never sent anywhere |
| Role (Owner / Sales Manager / Salesperson) | Decide what that person may access |
| Whether the account is active | Deactivated users cannot sign in |
| Session records | Keep you signed in; each has an expiry |
| Activity and audit records | Show who changed a lead, quotation or setting, and when |

### About the subscribing business

Business name, industry, phone, email, city, state, timezone, currency, and
workflow preferences such as follow-up defaults and lost-reason presets.

### Contact and sales data entered by the business

This is the bulk of what a workspace holds, and all of it is supplied by the
business itself:

- **Customers** — name, business name, contact person, phone, email, city,
  state, GST number
- **Leads** — title, description, product and quantity of interest, estimated
  value, source, status, priority, next action and deadline, and — where a lead
  was lost — the recorded reason
- **Quotations** — quotation number, value, status, dates, and line items
  (description, quantity, unit price)
- **Tasks** — follow-up title, due date, who it is assigned to
- **Activity history** — notes and status changes, with the user and timestamp
- **Products** — name and unit price

### From lead sources

Where a business connects a lead source, we store what that source sends. If an
incoming enquiry cannot be processed, the raw payload is retained (truncated)
in a failed-ingestion queue so the business can correct and retry it. That
payload may contain the enquirer's contact details.

### Technical and operational data

- **One cookie only:** `salesleak_session`. It is HTTP-only, `SameSite=Lax`,
  secure in production, and expires after 30 days. It exists solely to keep
  you signed in.
- **Server logs.** Structured records of failures — database, authentication,
  webhook, ingestion and billing errors. Logs deliberately carry identifiers
  (such as a company id) rather than record contents, and a redaction list
  strips password, token, secret, API-key, cookie and authorization fields
  before anything is written.

## 4. What we do NOT do

Verified against the deployed application, not merely intended:

- **No analytics or tracking of any kind.** No Google Analytics, no product
  analytics, no advertising pixels, no third-party scripts. The application's
  content security policy does not permit third-party script origins.
- **No tracking cookies, and therefore no cookie banner.** The single session
  cookie above is strictly necessary to sign in.
- **No advertising, and no selling or sharing of data with data brokers.**
- **No AI processing of your data.** The Service contains optional AI features,
  but they are **switched off in production** — no AI provider key is
  configured, so no workspace data is sent to any AI provider. If that ever
  changes, this policy must be updated *before* it is enabled.
- **No payment data.** Payment processing is not currently enabled, so we do
  not collect or store card details. When billing is enabled, card data will
  be handled by the payment provider and not stored by us — and this section
  will need updating.

## 5. Where your data is stored

- **Database:** Supabase, in the **`ap-southeast-1` (Singapore)** region.
- **Application servers:** Vercel, running in the **`sin1` (Singapore)**
  region.

So although SalesLeak is built for Indian businesses and defaults to Indian
timezone and rupees, **the data is stored and processed in Singapore, not in
India.**

This is permitted. Section 16 of India's Digital Personal Data Protection Act,
2023 allows transfer to any country **except** those the Central Government
specifically notifies as restricted, and as at the date of this draft no such
restricted-country list has been notified. Sector-specific localisation rules
(for example the Reserve Bank of India's payment-data mandate) would override
that, but none applies here because SalesLeak stores no payment data.

[DECISION REQUIRED: confirm the above with your lawyer before publication, and
re-check whether a restricted-country list has since been notified.]

## 6. Who else can see it (subprocessors)

Only these, and only because they run the infrastructure:

| Provider | Role |
|---|---|
| **Vercel** | Hosting and application servers |
| **Supabase** | Managed PostgreSQL database |

No one else. There is currently no analytics provider, no AI provider, no
payment provider, and no email marketing provider receiving workspace data.

Support email sent to `salesleak.support@gmail.com` is received through Google.

[DECISION REQUIRED: SUBPROCESSOR DISCLOSURE — whether you must publish this
list formally, notify customers before adding a subprocessor, and whether
written data processing agreements with Vercel and Supabase have been
executed.]

## 7. How long we keep it

Data stays in a workspace for as long as that workspace exists. When a
subscription lapses, the workspace becomes read-only — **data is not deleted**,
and it remains viewable and exportable.

[DECISION REQUIRED: RETENTION PERIODS — how long data is kept after a
workspace is closed or deletion is requested, whether backups have a separate
retention window, and how long audit and server logs are kept. State nothing
here until it is both decided and technically true; there is presently no
automated deletion or retention job in the Service.]

## 8. Security

- Passwords are hashed with **scrypt** and are never stored or transmitted in
  readable form.
- Sessions are database-backed with expiry, and deactivating a user
  immediately invalidates their sessions.
- **Workspace isolation is enforced on the server for every query**, not in
  the browser, and is covered by an automated test suite that fails if that
  isolation regresses.
- Access within a workspace is limited by role.
- Security headers are set on every response, including a content security
  policy, `X-Frame-Options`, and a strict referrer policy.
- Traffic is served over HTTPS.

No system is perfectly secure, and we do not claim otherwise.

[DECISION REQUIRED: BREACH NOTIFICATION — the notification obligations,
recipients and deadlines that apply to you, and the internal process for
meeting them. India's DPDP Act imposes specific requirements; do not state a
timeline before confirming it.]

## 9. Your rights

Depending on the law that applies to you, you may have rights to access,
correct, delete, or obtain a copy of your personal data, and to complain to a
regulator.

Practically, today:

- **Access and portability:** a workspace Owner can export customers, leads
  and quotations as CSV at any time, including while read-only.
- **Correction:** users with the right role can edit records directly.
- **Deletion:** contact us at the support address. Deletion is currently a
  manual operation.

**Raising a grievance.** Contact the Grievance Officer named in section 1. We
will acknowledge your request promptly, aim to resolve it within **7 working
days**, and complete redressal within **90 days** at the latest.

[DECISION REQUIRED: confirm you can actually meet those timelines before
publishing them — they reflect the DPDP Rules 2025 expectations, and a
published commitment you cannot honour is worse than a longer honest one. Also
confirm your identity-verification process for requests.]

## 10. Children

SalesLeak is a business tool and is not intended for anyone under 18. We do not
knowingly collect data from children.

## 11. Changes

We may update this policy. Material changes will be notified to workspace
Owners before taking effect.

---

**Effective date:** [DECISION REQUIRED: EFFECTIVE DATE — set only once every
marker is resolved and a lawyer has reviewed the result.]
