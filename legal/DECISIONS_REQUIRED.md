# Legal decisions required before publishing

Two drafts exist and are grounded in SalesLeak's real behaviour:

- [TERMS_OF_SERVICE.draft.md](TERMS_OF_SERVICE.draft.md)
- [PRIVACY_POLICY.draft.md](PRIVACY_POLICY.draft.md)

**Neither may be published until every item below is resolved and a lawyer has
reviewed the result.** The live `/terms` and `/privacy` pages deliberately
remain honest "not yet published" holding pages until then — that is safer than
publishing a document that looks final but contains unresolved commitments.

Nothing in these lists was guessed. Each item exists because the draft cannot
be truthful without a fact only you can supply.

---

## A. Blocking — nothing can be published without these

| # | Decision | Why it blocks |
|---|---|---|
| A1 | **Legal entity.** Registered name, entity type (private limited / LLP / sole proprietorship / none yet), and registration or CIN number. Also: is "NobleArc Technologies" a registered entity, a trading name, or neither? | Both documents open by naming who the agreement is with. There is no honest way to write this without knowing. |
| A2 | **Registered address**, and a **notice address** for legal correspondence if different from support. | Required to identify the operator and to receive formal notice. |
| A3 | **Governing law.** | Determines how every other clause is interpreted. |
| A4 | **Jurisdiction / dispute forum** — which courts, or arbitration seat and rules. | The product defaults to Indian timezone and rupees, but this depends on where the entity is actually established. |
| A5 | **Limitation of liability** — whether there is a cap, how it is calculated, and which losses are excluded. | This is the entire allocation of commercial risk. No placeholder was suggested on purpose; it needs a lawyer. |
| A6 | **Effective dates** for both documents. | Set only once everything else is resolved. |

## B. Blocking before you take payment

| # | Decision |
|---|---|
| B1 | **Real pricing.** The values in the product (₹1,999/mo Starter) are marked in code as illustrative placeholders, not a pricing decision. Confirm the real prices. |
| B2 | **GST treatment** — whether prices are inclusive or exclusive, and your GSTIN if registered. |
| B3 | **Payment terms** — billing cycle, renewal behaviour, cancellation effect, and proration. |
| B4 | **Refund policy.** |

Until these are settled, do not publish the Terms as final with billing live.

## C. Blocking before real customer data

| # | Decision | Current honest position |
|---|---|---|
| C1 | **Backup commitment** — any frequency, retention or recovery promise. | **Say nothing yet.** The production database has no automatic backups and no restore has ever been tested. Any promise today would be false. Resolve by upgrading Supabase first. |
| C2 | **Retention periods** — after workspace closure, after a deletion request, for backups, and for audit and server logs. | There is currently no automated deletion or retention job. Do not state a period the system cannot honour. |
| C3 | **Deletion timeline** — how fast deletion happens after a request. | Deletion is presently a manual operation. |
| C4 | **Breach notification** obligations, recipients and deadlines. | India's DPDP Act imposes specific requirements. |

## D. India / DPDP-specific — needs a lawyer familiar with the Act

| # | Question |
|---|---|
| D1 | **Does the DPDP Act 2023 apply to your operation**, given the entity's establishment and that customers are Indian businesses? |
| D2 | **Cross-border processing.** Data is stored and processed in **Singapore** (Supabase `ap-southeast-1`, Vercel `sin1`), not India. Confirm what this requires — this is a real arrangement, not a hypothetical. |
| D3 | **Grievance redressal mechanism** — the Act expects a published contact and process. Do not claim one exists until it does. |
| D4 | **Data Protection Officer** — whether you must appoint one. Do not assert a DPO exists unless one does. |
| D5 | **Controller / processor split.** The draft treats you as controller for your Users and processor for their Contacts. Confirm this is right, and whether you need a data processing agreement with each subscribing business. |

## E. Commercial choices — not strictly blocking, but decide deliberately

| # | Decision |
|---|---|
| E1 | **Indemnity** — whether customers indemnify you for misuse or for third-party personal data they upload. |
| E2 | **Warranty disclaimer scope**, and which statutory rights cannot be excluded under A3. |
| E3 | **Subprocessor disclosure** — whether to publish the list formally and notify before adding one. |
| E4 | **Data processing agreements with Vercel and Supabase** — check whether these have actually been executed. |
| E5 | **Service level commitments.** The draft currently offers none, which is honest for this stage. |

---

## How to finish this

1. Answer section **A** — that unblocks everything else.
2. Answer **C** only after upgrading Supabase, so the backup and retention
   statements can be true rather than aspirational.
3. Take both drafts, with your answers, to a lawyer familiar with Indian SaaS
   and the DPDP Act. The drafts exist so that review is cheap and concrete.
4. Once approved, replace the holding pages at `src/app/terms/page.tsx` and
   `src/app/privacy/page.tsx` with the final text.
5. Update [../LAUNCH_CHECKLIST.md](../LAUNCH_CHECKLIST.md) and
   [../PROJECT_STATE.md](../PROJECT_STATE.md).

**Do not shortcut step 3.** These drafts are a serious starting point, not a
substitute for legal review.
