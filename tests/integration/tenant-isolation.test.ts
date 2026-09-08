import { describe, it, expect } from "vitest";
import { db, signInAs } from "../helpers/setup";
import { ALPHA, BETA } from "../helpers/fixtures";
import { ForbiddenError } from "@/server/auth/permissions";
import * as leads from "@/server/actions/leads";
import * as quotations from "@/server/actions/quotations";
import { rescheduleTask } from "@/server/actions/tasks";
import { markNotificationRead } from "@/server/actions/notifications";
import { updateUserRole, setUserActive } from "@/server/actions/users";
import { getLeadDetail } from "@/server/data/leads";
import { getCustomerDetail } from "@/server/data/customers";
import { getQuotationDetail } from "@/server/data/quotations";

/**
 * Every test here signs in as a real Alpha user and passes a real, existing
 * Beta record id — the realistic attack, not a malformed id. Each assertion
 * checks two things: the call was refused, AND Beta's row is unchanged.
 * Refusing loudly while still writing would pass a throw-only assertion.
 */
function betaLead() {
  return db.all("lead").find((l) => l.id === BETA.leadId)!;
}
function betaQuotation() {
  return db.all("quotation").find((q) => q.id === BETA.quotationId)!;
}
function betaTask() {
  return db.all("task").find((t) => t.id === BETA.taskId)!;
}
function betaUser(id: string) {
  return db.all("user").find((u) => u.id === id)!;
}

describe("Leads — cross-tenant mutation is refused", () => {
  it("markContacted cannot touch another company's lead", async () => {
    signInAs(ALPHA.ownerId);
    const before = betaLead();

    await expect(leads.markContacted(BETA.leadId, null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaLead().status).toBe(before.status);
    expect(db.all("activity")).toHaveLength(0);
  });

  it("changeStatus cannot touch another company's lead", async () => {
    signInAs(ALPHA.ownerId);

    await expect(leads.changeStatus(BETA.leadId, "CONTACTED", null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaLead().status).toBe("NEW");
  });

  it("markWon cannot close another company's lead", async () => {
    signInAs(ALPHA.ownerId);

    await expect(leads.markWon(BETA.leadId, null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaLead().status).toBe("NEW");
    expect(betaLead().wonAt).toBeNull();
    expect(db.all("auditLog")).toHaveLength(0);
  });

  it("markLost cannot close another company's lead", async () => {
    signInAs(ALPHA.ownerId);

    await expect(leads.markLost(BETA.leadId, "Price", null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaLead().status).toBe("NEW");
    expect(betaLead().lostAt).toBeNull();
  });

  it("addNote cannot write onto another company's lead timeline", async () => {
    signInAs(ALPHA.ownerId);

    await expect(leads.addNote(BETA.leadId, "injected note", null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(db.all("activity")).toHaveLength(0);
  });

  it("updateNextAction cannot rewrite another company's lead", async () => {
    signInAs(ALPHA.ownerId);

    await expect(leads.updateNextAction(BETA.leadId, "Do this", "2026-12-01", null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaLead().nextAction).toBe("Send quote");
  });

  it("scheduleFollowUp cannot create a task on another company's lead", async () => {
    signInAs(ALPHA.ownerId);
    const taskCount = db.all("task").length;

    await expect(leads.scheduleFollowUp(BETA.leadId, "Injected", "2026-12-01", null, null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(db.all("task")).toHaveLength(taskCount);
  });

  it("completeTask cannot complete another company's task", async () => {
    signInAs(ALPHA.ownerId);

    await expect(leads.completeTask(BETA.taskId, BETA.leadId, null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaTask().status).toBe("PENDING");
  });

  it("a task id from Beta cannot be completed by pairing it with an Alpha lead", async () => {
    signInAs(ALPHA.ownerId);

    // The lead is legitimately Alpha's, so the lead check passes — the task
    // must still be rejected because it does not belong to that lead.
    await expect(leads.completeTask(BETA.taskId, ALPHA.leadId, null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaTask().status).toBe("PENDING");
  });

  it("assignSalesperson cannot assign a lead to a user from another company", async () => {
    signInAs(ALPHA.ownerId);

    await expect(leads.assignSalesperson(ALPHA.leadId, BETA.salespersonId, null)).rejects.toBeInstanceOf(ForbiddenError);

    const alphaLead = db.all("lead").find((l) => l.id === ALPHA.leadId)!;
    expect(alphaLead.ownerId).toBe(ALPHA.salespersonId);
  });

  /**
   * Regression test for the defect this wave found. `scheduleFollowUp` took
   * `assignedToId` straight from the caller and wrote it to Task.assignedTo,
   * which is a bare FK to User with no company column — so an Alpha user
   * could attach a Beta user to an Alpha task, and the work queue (which
   * joins `assignedTo` unscoped) would then render that Beta user's details
   * inside Alpha's UI. Before the fix this test failed with the created task
   * carrying `assignedToId: user_beta_sales`.
   */
  it("scheduleFollowUp cannot assign a follow-up to a user from another company", async () => {
    signInAs(ALPHA.ownerId);
    const taskCount = db.all("task").length;

    await expect(leads.scheduleFollowUp(ALPHA.leadId, "Call the buyer", "2026-12-01", BETA.salespersonId, null)).rejects.toBeInstanceOf(
      ForbiddenError
    );

    // No task was created at all, and nothing references the Beta user.
    expect(db.all("task")).toHaveLength(taskCount);
    expect(db.all("task").some((t) => t.assignedToId === BETA.salespersonId && t.leadId === ALPHA.leadId)).toBe(false);
  });

  it("scheduleFollowUp still accepts an assignee from the caller's own company", async () => {
    signInAs(ALPHA.ownerId);

    const result = await leads.scheduleFollowUp(ALPHA.leadId, "Call the buyer", "2026-12-01", ALPHA.salespersonId, null);

    expect(result.success).toBe(true);
    const created = db.all("task").find((t) => t.title === "Call the buyer")!;
    expect(created.assignedToId).toBe(ALPHA.salespersonId);
  });

  it("scheduleFollowUp still accepts an unassigned follow-up", async () => {
    signInAs(ALPHA.ownerId);

    const result = await leads.scheduleFollowUp(ALPHA.leadId, "Unassigned task", "2026-12-01", null, null);

    expect(result.success).toBe(true);
    expect(db.all("task").find((t) => t.title === "Unassigned task")!.assignedToId).toBeNull();
  });
});

describe("Leads — same-company access still works", () => {
  it("an Alpha owner can act on an Alpha lead", async () => {
    signInAs(ALPHA.ownerId);

    await leads.markContacted(ALPHA.leadId, null);

    const lead = db.all("lead").find((l) => l.id === ALPHA.leadId)!;
    expect(lead.status).toBe("CONTACTED");
    expect(db.all("activity")).toHaveLength(1);
  });

  it("attributes the activity to the session user, never a client-supplied id", async () => {
    signInAs(ALPHA.salespersonId);

    // The caller tries to attribute the note to the Alpha owner.
    await leads.addNote(ALPHA.leadId, "who wrote this?", ALPHA.ownerId);

    const activity = db.all("activity")[0];
    expect(activity.userId).toBe(ALPHA.salespersonId);
    expect(activity.userId).not.toBe(ALPHA.ownerId);
  });
});

describe("Quotations — cross-tenant mutation is refused", () => {
  it("createQuotation cannot attach a quotation to another company's lead", async () => {
    signInAs(ALPHA.ownerId);

    await expect(
      quotations.createQuotation(
        { leadId: BETA.leadId, quotationNumber: "X-1", items: [{ productId: null, description: "Item", quantity: 1, unitPrice: 10 }], sentAt: null, validUntil: null, nextAction: null, followUpDate: null, notes: null },
        null
      )
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(db.all("quotation")).toHaveLength(2);
  });

  it("createQuotation cannot reference another company's product", async () => {
    signInAs(ALPHA.ownerId);

    await expect(
      quotations.createQuotation(
        { leadId: ALPHA.leadId, quotationNumber: "X-2", items: [{ productId: BETA.productId, description: "Item", quantity: 1, unitPrice: 10 }], sentAt: null, validUntil: null, nextAction: null, followUpDate: null, notes: null },
        null
      )
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(db.all("quotation")).toHaveLength(2);
  });

  it("markQuotationSent cannot touch another company's quotation", async () => {
    signInAs(ALPHA.ownerId);

    await expect(quotations.markQuotationSent(BETA.quotationId, null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaQuotation().status).toBe("SENT");
  });

  it("changeQuotationStatus cannot touch another company's quotation", async () => {
    signInAs(ALPHA.ownerId);

    await expect(quotations.changeQuotationStatus(BETA.quotationId, "FOLLOWED_UP", null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaQuotation().status).toBe("SENT");
  });

  it("markQuotationWon cannot win another company's quotation", async () => {
    signInAs(ALPHA.ownerId);

    await expect(quotations.markQuotationWon(BETA.quotationId, null, true)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaQuotation().status).toBe("SENT");
    expect(betaLead().status).toBe("NEW");
  });

  it("markQuotationLost cannot lose another company's quotation", async () => {
    signInAs(ALPHA.ownerId);

    await expect(quotations.markQuotationLost(BETA.quotationId, "Price", null, true)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaQuotation().status).toBe("SENT");
    expect(betaLead().status).toBe("NEW");
  });

  it("addQuotationNote cannot write onto another company's quotation", async () => {
    signInAs(ALPHA.ownerId);

    await expect(quotations.addQuotationNote(BETA.quotationId, "injected", null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(db.all("activity")).toHaveLength(0);
  });

  it("an Alpha owner can still create a quotation on an Alpha lead", async () => {
    signInAs(ALPHA.ownerId);

    const result = await quotations.createQuotation(
      { leadId: ALPHA.leadId, quotationNumber: "ALPHA-002", items: [{ productId: ALPHA.productId, description: "Widget", quantity: 2, unitPrice: 50 }], sentAt: null, validUntil: null, nextAction: null, followUpDate: null, notes: null },
      null
    );

    expect(result.success).toBe(true);
    const created = db.all("quotation").find((q) => q.quotationNumber === "ALPHA-002")!;
    expect(created.companyId).toBe(ALPHA.companyId);
    // The total is computed server-side from quantity x unit price.
    expect(created.value).toBe(100);
  });
});

describe("Tasks — cross-tenant mutation is refused", () => {
  it("rescheduleTask cannot move another company's task", async () => {
    signInAs(ALPHA.ownerId);
    const originalDue = betaTask().dueDate;

    await expect(rescheduleTask(BETA.taskId, "2026-12-25", null)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaTask().dueDate).toEqual(originalDue);
  });

  it("an Alpha user can reschedule an Alpha task", async () => {
    signInAs(ALPHA.ownerId);

    await rescheduleTask(ALPHA.taskId, "2026-12-25", null);

    const task = db.all("task").find((t) => t.id === ALPHA.taskId)!;
    expect((task.dueDate as Date).toISOString()).toContain("2026-12-25");
  });
});

describe("Team — cross-tenant user administration is refused", () => {
  it("an Alpha owner cannot change a Beta user's role", async () => {
    signInAs(ALPHA.ownerId);

    await expect(updateUserRole(BETA.salespersonId, "OWNER")).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaUser(BETA.salespersonId).role).toBe("SALESPERSON");
  });

  it("an Alpha owner cannot deactivate a Beta user", async () => {
    signInAs(ALPHA.ownerId);

    await expect(setUserActive(BETA.salespersonId, false)).rejects.toBeInstanceOf(ForbiddenError);

    expect(betaUser(BETA.salespersonId).isActive).toBe(true);
  });
});

describe("Notifications — cross-tenant read state is refused", () => {
  it("an Alpha user cannot mark a Beta notification read", async () => {
    signInAs(ALPHA.ownerId);

    await expect(markNotificationRead(BETA.notificationId)).rejects.toBeInstanceOf(ForbiddenError);

    expect(db.all("notification").find((n) => n.id === BETA.notificationId)!.isRead).toBe(false);
  });
});

describe("Read paths — detail queries are company-scoped", () => {
  it("getLeadDetail returns null for another company's lead", async () => {
    expect(await getLeadDetail(BETA.leadId, ALPHA.companyId)).toBeNull();
  });

  it("getLeadDetail returns the record for its own company", async () => {
    const lead = await getLeadDetail(ALPHA.leadId, ALPHA.companyId);
    expect(lead?.id).toBe(ALPHA.leadId);
  });

  it("getCustomerDetail returns null for another company's customer", async () => {
    expect(await getCustomerDetail(BETA.customerId, ALPHA.companyId)).toBeNull();
  });

  it("getQuotationDetail returns null for another company's quotation", async () => {
    expect(await getQuotationDetail(BETA.quotationId, ALPHA.companyId)).toBeNull();
  });
});
