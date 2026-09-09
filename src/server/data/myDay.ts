import { getLeadsForCompany } from "./leads";
import { getQuotationsForCompany } from "./quotations";
import { getCustomersForCompany } from "./customers";
import { getWorkQueueForCompany } from "./tasks";

/**
 * Everything the "My Day" view needs for one salesperson, composed entirely
 * from the existing lead/quotation/customer/task services — no new risk
 * logic, just a personal filter over what already exists.
 *
 * On the company-wide fetch below, which looks wasteful and has been queried
 * before. Measured against production (2026-09-09, warm, 3 runs each):
 *
 *   /api/health (one `SELECT 1`)  474ms
 *   /leads                       2282ms
 *   /tasks                       2302ms
 *   /my-day                      2263ms
 *
 * My Day runs roughly four times the data-helper work of /leads and is not
 * slower — marginally faster, within noise. The reason is the Promise.all
 * below: the four helpers run concurrently, so their cost is the slowest one,
 * not the sum. The ~1.8s every page shares over a bare `SELECT 1` is fixed
 * per-request overhead, and even that trivial query costs 474ms because
 * Vercel executes in iad1 while Supabase lives in ap-southeast-1. That
 * cross-region round trip dominates everything here; no query rewrite touches
 * it, and moving regions is a human infrastructure decision.
 *
 * What IS real: each helper fetches every lead/quotation/customer in the
 * company and then discards the ones this user does not own, so a ten-person
 * team transfers about ten times the rows it needs. That is a bandwidth and
 * memory concern at thousands of leads, not a latency one, and it is invisible
 * at current volumes. Worth pushing `ownerId` into the lead and quotation
 * queries when data volume justifies it — but note the customer filter is
 * derived (assignedSalesperson comes from the most recent lead's owner), so
 * that one cannot simply move into SQL.
 */
export async function getMyDayData(companyId: string, userId: string) {
  const [leads, quotations, customers, workQueue] = await Promise.all([
    getLeadsForCompany(companyId),
    getQuotationsForCompany(companyId),
    getCustomersForCompany(companyId),
    getWorkQueueForCompany(companyId, { userId }),
  ]);

  const myLeads = leads.filter((l) => l.ownerId === userId);
  const myQuotations = quotations.filter((q) => q.lead.ownerId === userId);

  return {
    overdueTasks: workQueue.overdue,
    dueToday: workQueue.dueToday,
    upcoming: workQueue.upcoming,
    newEnquiries: myLeads.filter((l) => l.status === "NEW"),
    quotationsNeedingFollowUp: myQuotations.filter((q) => q.risk.needsAttention),
    highValueAttention: myLeads.filter((l) => l.risk.isHighRiskOpportunity),
    repeatOrderOpportunities: customers.filter(
      (c) => c.assignedSalesperson?.id === userId && c.repeatOrderSignal.eligible && c.repeatOrderSignal.status !== "Normal"
    ),
  };
}

export type MyDayData = Awaited<ReturnType<typeof getMyDayData>>;
