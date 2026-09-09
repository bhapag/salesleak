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
 * before: it is not what made this page slow. Warm medians, measured in
 * production before and after moving Serverless Functions from iad1 to sin1,
 * co-locating them with Supabase in ap-southeast-1 (see vercel.json):
 *
 *                                 iad1      sin1
 *   /api/health (one `SELECT 1`)  516ms     134ms
 *   /leads                       2269ms     174ms
 *   /tasks                       2261ms     169ms
 *   /my-day                      2282ms     179ms
 *
 * Two things follow. First, My Day runs roughly four times the data-helper
 * work of /leads and is not slower, because the Promise.all below runs the
 * helpers concurrently — their cost is the slowest one, not the sum. Second,
 * essentially all of the old 2.27s was cross-continent database round trips,
 * not query design; a bare `SELECT 1` cost 516ms for the same reason.
 *
 * What IS real, and still unfixed: each helper fetches every lead, quotation
 * and customer in the company and then discards the ones this user does not
 * own, so a ten-person team transfers about ten times the rows it needs. That
 * is a bandwidth and memory concern at thousands of leads, not a latency one,
 * and it is invisible at current volumes. Worth pushing `ownerId` into the
 * lead and quotation queries when data volume justifies it — but note the
 * customer filter is derived (assignedSalesperson comes from the most recent
 * lead's owner), so that one cannot simply move into SQL.
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
