# Legal decisions required before publishing

Two drafts exist and are grounded in SalesLeak's real behaviour:

- [TERMS_OF_SERVICE.draft.md](TERMS_OF_SERVICE.draft.md)
- [PRIVACY_POLICY.draft.md](PRIVACY_POLICY.draft.md)

**Neither may be published until the blocking items below are resolved and a
lawyer has reviewed the result.** The live `/terms` and `/privacy` pages
deliberately remain honest "not yet published" holding pages until then.

Several questions that were open have since been **researched and closed** —
see the last section. What remains is genuinely short.

---

## A. Blocking — nothing can be published without these

| # | Decision | Why it blocks |
|---|---|---|
| A1 | **Legal entity.** Registered name, entity type (private limited / LLP / sole proprietorship / not yet registered), and registration or CIN number. Is "NobleArc Technologies" a registered entity, a trading name, or neither? | Both documents open by naming who the agreement is with. |
| A2 | **Registered address**, plus a **notice address** for legal correspondence if different from support. | Required to identify the operator and receive formal notice. |
| A3 | **Governing law** and **jurisdiction / dispute forum**. | Determines how every other clause is read. Given an Indian operator and Indian customers this is very likely India plus a named city's courts, but it follows from A1. |
| A4 | **Limitation of liability** — cap, how calculated, which losses excluded. | The entire allocation of commercial risk. Needs a lawyer; no placeholder was invented. |
| A5 | **Grievance Officer** — the named individual and a published contact. | **This is a legal requirement, not a choice.** See research below. |
| A6 | **Effective dates**, set once everything else is resolved. | — |

## B. Blocking before you take payment

| # | Decision |
|---|---|
| B1 | **Real pricing.** The ₹1,999/mo Starter figure is marked in code as an illustrative placeholder, not a pricing decision. |
| B2 | **GST treatment** — inclusive or exclusive, and your GSTIN if registered. |
| B3 | **Payment terms** — billing cycle, renewal, cancellation effect, proration. |
| B4 | **Refund policy.** |

## C. Blocking before real customer data

| # | Decision | Position |
|---|---|---|
| C1 | **Backup commitment** — any frequency, retention or recovery promise in the Terms. | A first manual `pg_dump` now exists, but there are still **no automatic backups** and **no tested restore**. Promise nothing until Supabase is upgraded. |
| C2 | **Retention period** — how long data is kept after a workspace closes or a deletion request. | **Your choice** — no statutory period applies to SalesLeak (see research). Pick something you can actually honour; there is currently no automated deletion job. |
| C3 | **Deletion timeline** after a request. | Deletion is presently manual. |
| C4 | **Breach notification process** — who does what, and how fast. | Required under DPDP; agree the internal process before you need it. |

## D. India / DPDP — what is left after research

| # | Item | Status |
|---|---|---|
| D1 | Does DPDP apply? | **Assume yes** if you operate from India and serve Indian businesses. Confirm with your lawyer as part of A1. |
| D2 | Appoint and publish a **Grievance Officer**. | **Required.** A name and contact must appear in the Privacy Policy. |
| D3 | **Log retention ≥ 1 year.** | **Required.** Currently not met — Vercel's log retention on the present plan is far shorter. Raise with your lawyer and decide how to satisfy it. |
| D4 | Data processing terms with **your customers** (you process their contacts). | Decide whether a DPA addendum is offered. Best practice for B2B. |

## E. Commercial choices — decide deliberately, not blocking

| # | Decision |
|---|---|
| E1 | **Indemnity** from customers for misuse or for third-party data they upload. |
| E2 | **Warranty disclaimer** scope. |
| E3 | Whether to publish the **subprocessor list** formally and notify before changes. |
| E4 | Confirm **data processing agreements with Vercel and Supabase** are in place. |
| E5 | **Service level commitments.** The draft offers none, which is honest at this stage. |

---

## Researched and closed — these are no longer open questions

Checked against the DPDP Act 2023 and the **DPDP Rules 2025, notified
13 November 2025**. This is research, not legal advice, and your lawyer should
confirm it — but these no longer need *your* decision.

**1. Hosting in Singapore is permitted.** ✅ *Requirement satisfied*
Section 16 of the DPDP Act uses a **negative list**: transfer is allowed to any
country except those the Central Government specifically notifies as
restricted. **As of mid-2026 no restricted-country list has been notified**, so
storing data in Singapore (Supabase `ap-southeast-1`, Vercel `sin1`) is
permitted. This is far more permissive than GDPR's adequacy model. The one
carve-out — RBI's payment-data localisation — does not apply, because SalesLeak
stores no payment data.
*Previously flagged as a blocking cross-border question. It is not.*

**2. You do NOT need a Data Protection Officer.** ✅ *Not applicable*
A DPO is required only of a **Significant Data Fiduciary**, which the
government designates based on volume and sensitivity of data. SalesLeak at
pilot scale is not one, and SDF obligations do not even come into force until
**13 May 2027**. Non-SDF fiduciaries need a grievance mechanism, not a DPO.
*Do not appoint a DPO or claim one exists.*

**3. You DO need a Grievance Officer.** ⚠️ *Required — this is A5*
Every Data Fiduciary must appoint one and publish the contact. It can be any
competent person in the organisation — at your scale, you. Indicative
timelines: acknowledge promptly, resolve most requests within about **7 working
days**, and complete redressal within **90 days**.

**4. No statutory retention period applies to you.** ✅ *Your choice*
The Third Schedule's fixed three-year erasure rules apply only to
**e-commerce and social media with 2 crore+ users, and online gaming with
50 lakh+ users**. SalesLeak is none of those and nowhere near those thresholds,
so you choose your own retention period (C2). If you later set one, note the
Rules expect data principals to be notified **48 hours before** erasure.

**5. Logs must be kept for at least one year.** ⚠️ *Required — this is D3*
Data Fiduciaries must retain system and processing logs and associated traffic
data for a minimum of one year for detection, investigation and remediation.
**SalesLeak does not currently meet this** — logs go to Vercel, whose retention
on the current plan is much shorter. This needs a decision: longer log
retention, or shipping logs somewhere durable.

**6. Penalties are material.** Up to **₹250 crore**. Worth the lawyer's fee.

Sources:
[DPDP Rules 2025 — Gazette notification (PIB)](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf) ·
[Significant Data Fiduciaries and data transfers (SFLC.in)](https://sflc.in/dpdp-rules-2025-significant-data-fiduciaries-and-data-transfers/) ·
[Cross-border transfers under the DPDP Act (MediaNama)](https://www.medianama.com/2025/11/223-dpdp-rules-cross-border-data-transfers/) ·
[Grievance Officers under the DPDP Act and 2025 Rules (K&K)](https://ksandk.com/data-protection-and-data-privacy/grievance-officers-under-indias-dpdp-act-and-2025-rules/) ·
[DPDP Rules 2025 compliance guide (Seclore)](https://www.seclore.com/fundamentals/dpdp-rules-2025-compliance-guide/) ·
[DPDP Act and Rules compliance guide (EY India)](https://www.ey.com/en_in/insights/cybersecurity/decoding-the-digital-personal-data-protection-act-2023)

---

## How to finish this

1. Answer **A1–A2** — entity and address. That unblocks A3 and most of the rest.
2. Name yourself **Grievance Officer** (A5) and decide the log-retention
   approach (D3). Both are legal requirements, not preferences.
3. Answer **C1–C3** after upgrading Supabase, so backup and retention
   statements are true rather than aspirational.
4. Take both drafts plus your answers to a lawyer familiar with Indian SaaS and
   the DPDP Rules 2025. The drafts and the research above exist to make that
   review short and cheap.
5. Replace the holding pages at `src/app/terms/page.tsx` and
   `src/app/privacy/page.tsx` with the approved text.
6. Update [../LAUNCH_CHECKLIST.md](../LAUNCH_CHECKLIST.md) and
   [../PROJECT_STATE.md](../PROJECT_STATE.md).

**Do not shortcut step 4.**
