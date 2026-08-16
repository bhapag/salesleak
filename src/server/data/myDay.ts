import { getLeadsForCompany } from "./leads";
import { getQuotationsForCompany } from "./quotations";
import { getCustomersForCompany } from "./customers";
import { getWorkQueueForCompany } from "./tasks";

/**
 * Everything the "My Day" view needs for one salesperson, composed entirely
 * from the existing lead/quotation/customer/task services — no new risk
 * logic, just a personal filter over what already exists.
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
