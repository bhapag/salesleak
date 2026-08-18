import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/server/auth/password";

// This seeds two fictional demo companies with fake accounts and a shared
// known password — never run it against a database holding real customer
// data. `prisma migrate deploy` (schema only) is the production path;
// this script is dev/staging-only, per DEPLOYMENT.md.
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run the demo seed against a production database (NODE_ENV=production).");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Every seeded demo account (both companies) uses this password — shown on
// the /login page in dev mode. Never used for anything but local demo data.
const DEMO_PASSWORD = "password123";

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// Creates a fully closed historical deal (Lead + matching accepted Quotation +
// a couple of Activities) so repeat-order detection has real order history to
// work from. Returns the created lead, in case a caller wants its id.
async function createWonOrder(opts: {
  companyId: string;
  customerId: string;
  ownerId: string;
  title: string;
  product: { id: string; name: string };
  quantity: string;
  value: number;
  wonAt: Date;
  source: "INDIAMART" | "JUSTDIAL" | "EXPORTERS_INDIA" | "TRADEINDIA" | "WHATSAPP" | "EMAIL" | "WEBSITE" | "PHONE" | "REFERRAL" | "CSV_IMPORT" | "MANUAL";
  quotationNumber: string;
}) {
  const createdAt = new Date(opts.wonAt.getTime() - 12 * 24 * 60 * 60 * 1000);
  const sentAt = new Date(opts.wonAt.getTime() - 8 * 24 * 60 * 60 * 1000);

  const lead = await prisma.lead.create({
    data: {
      companyId: opts.companyId,
      customerId: opts.customerId,
      ownerId: opts.ownerId,
      source: opts.source,
      status: "WON",
      priority: "MEDIUM",
      title: opts.title,
      product: opts.product.name,
      quantity: opts.quantity,
      estimatedValue: opts.value,
      wonAt: opts.wonAt,
      createdAt,
    },
  });

  await prisma.activity.createMany({
    data: [
      {
        leadId: lead.id,
        userId: opts.ownerId,
        type: "CALL",
        notes: "Discussed requirement and finalized order.",
        createdAt: new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      { leadId: lead.id, userId: opts.ownerId, type: "STATUS_CHANGE", notes: "Marked as Won.", createdAt: opts.wonAt },
    ],
  });

  const quotation = await prisma.quotation.create({
    data: {
      leadId: lead.id,
      companyId: opts.companyId,
      quotationNumber: opts.quotationNumber,
      value: opts.value,
      status: "ACCEPTED",
      sentAt,
      wonAt: opts.wonAt,
    },
  });
  await prisma.quotationItem.create({
    data: { quotationId: quotation.id, productId: opts.product.id, description: opts.product.name, quantity: 1, unitPrice: opts.value, total: opts.value },
  });

  return lead;
}

async function main() {
  // Wipe existing data (dev-only, order matters for FKs)
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.task.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      name: "Shree Balaji Industrial Equipments Pvt. Ltd.",
      city: "Ahmedabad",
      state: "Gujarat",
      industry: "Industrial Valves & Pumps Manufacturing",
      onboardedAt: new Date(), // seeded companies skip the onboarding wizard
    },
  });
  // Seeded demo companies get FOUNDING/ACTIVE, never TRIAL — a real signup
  // via /signup is the only path that starts a trial (see auth.ts). This is
  // what keeps a demo reset from ever locking the demo accounts out.
  await prisma.subscription.create({
    data: { companyId: company.id, plan: "FOUNDING", status: "ACTIVE", currentPeriodStart: new Date() },
  });

  const passwordHash = hashPassword(DEMO_PASSWORD);

  const owner = await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Rajesh Mehta",
      email: "rajesh@shreebalaji.in",
      role: "OWNER",
      passwordHash,
    },
  });

  const manager = await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Priya Sharma",
      email: "priya@shreebalaji.in",
      role: "SALES_MANAGER",
      passwordHash,
    },
  });

  const amit = await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Amit Verma",
      email: "amit@shreebalaji.in",
      role: "SALESPERSON",
      passwordHash,
    },
  });

  const sneha = await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Sneha Patil",
      email: "sneha@shreebalaji.in",
      role: "SALESPERSON",
      passwordHash,
    },
  });

  const [ballValve, gateValve, pump, butterflyValve, pressureGauge] =
    await Promise.all([
      prisma.product.create({
        data: {
          companyId: company.id,
          name: 'Ball Valve 2"',
          sku: "BV-2IN",
          unit: "piece",
          defaultPrice: 1450,
        },
      }),
      prisma.product.create({
        data: {
          companyId: company.id,
          name: 'Gate Valve 4"',
          sku: "GV-4IN",
          unit: "piece",
          defaultPrice: 3200,
        },
      }),
      prisma.product.create({
        data: {
          companyId: company.id,
          name: "Centrifugal Pump 5HP",
          sku: "CP-5HP",
          unit: "piece",
          defaultPrice: 18500,
        },
      }),
      prisma.product.create({
        data: {
          companyId: company.id,
          name: 'Butterfly Valve 6"',
          sku: "BFV-6IN",
          unit: "piece",
          defaultPrice: 5400,
        },
      }),
      prisma.product.create({
        data: {
          companyId: company.id,
          name: "Pressure Gauge 100mm",
          sku: "PG-100",
          unit: "piece",
          defaultPrice: 620,
        },
      }),
    ]);

  const customerData = [
    { name: "Ganesh Steel Industries", city: "Rajkot", state: "Gujarat", contactPerson: "Mahesh Joshi" },
    { name: "Patel Agro Processing Pvt. Ltd.", city: "Anand", state: "Gujarat", contactPerson: "Ramesh Patel" },
    { name: "Kiran Textile Mills", city: "Surat", state: "Gujarat", contactPerson: "Kiran Shah" },
    { name: "Om Sai Chemicals", city: "Vadodara", state: "Gujarat", contactPerson: "Sanjay Iyer" },
    { name: "National Fabricators", city: "Pune", state: "Maharashtra", contactPerson: "Vinod Kulkarni" },
    { name: "Bharat Engineering Corporation", city: "Ludhiana", state: "Punjab", contactPerson: "Harpreet Singh" },
    { name: "Vikram Pumps & Fittings", city: "Coimbatore", state: "Tamil Nadu", contactPerson: "Vikram Nair" },
    { name: "Deccan Steel Traders", city: "Nagpur", state: "Maharashtra", contactPerson: "Anil Deshmukh" },
  ];

  const customers = await Promise.all(
    customerData.map((c) =>
      prisma.customer.create({
        data: {
          companyId: company.id,
          name: c.name,
          companyName: c.name,
          contactPerson: c.contactPerson,
          phone: "+91 9" + Math.floor(100000000 + Math.random() * 899999999),
          email: c.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "") + "@example.in",
          city: c.city,
          state: c.state,
          gstNumber: "24AAAAA0000A1Z" + Math.floor(Math.random() * 9),
        },
      })
    )
  );

  const [ganesh, patel, kiran, omSai, national, bharat, vikram, deccan] = customers;

  // ---- Leads (mix of sources, statuses, at-risk and healthy) ----

  const leadOverdue = await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: ganesh.id,
      ownerId: amit.id,
      source: "INDIAMART",
      status: "QUOTATION_SENT",
      priority: "HIGH",
      title: "50 Ball Valves for steel plant expansion",
      description: "Enquired via IndiaMART about bulk ball valves for new production line.",
      product: 'Ball Valve 2"',
      quantity: "50 pieces",
      estimatedValue: 72500,
      nextAction: "Call to confirm quotation approval",
      nextActionDeadline: daysFromNow(-3),
      createdAt: daysFromNow(-14),
    },
  });

  const leadDueToday = await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: patel.id,
      ownerId: sneha.id,
      source: "WHATSAPP",
      status: "NEGOTIATION",
      priority: "HIGH",
      title: "Centrifugal pumps for agro processing unit",
      description: "Discussing pricing for 3 units of 5HP centrifugal pumps.",
      product: "Centrifugal Pump 5HP",
      quantity: "3 units",
      estimatedValue: 55500,
      nextAction: "Send revised pricing after manager approval",
      nextActionDeadline: daysFromNow(0),
      createdAt: daysFromNow(-9),
    },
  });

  const leadUpcoming = await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: kiran.id,
      ownerId: amit.id,
      source: "JUSTDIAL",
      status: "CONTACTED",
      priority: "MEDIUM",
      title: "Gate valves for textile mill boiler room",
      description: "Initial enquiry call done, awaiting technical specs from customer.",
      product: 'Gate Valve 4"',
      quantity: "9 pieces",
      estimatedValue: 28800,
      nextAction: "Follow up for technical drawing",
      nextActionDeadline: daysFromNow(4),
      createdAt: daysFromNow(-2),
    },
  });

  await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: omSai.id,
      ownerId: manager.id,
      source: "EMAIL",
      status: "NEW",
      priority: "MEDIUM",
      title: "Butterfly valves enquiry for chemical plant",
      description: "Enquiry received by email, not yet contacted.",
      product: 'Butterfly Valve 6"',
      quantity: "8 pieces",
      estimatedValue: 43200,
      nextAction: "Make first contact call",
      nextActionDeadline: daysFromNow(1),
      createdAt: daysFromNow(-1),
    },
  });

  await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: national.id,
      source: "WEBSITE",
      status: "NEW",
      priority: "LOW",
      title: "Pressure gauges for fabrication unit",
      description: "Website contact form submission, unassigned.",
      product: "Pressure Gauge 100mm",
      quantity: "20 pieces",
      estimatedValue: 12400,
      createdAt: daysFromNow(-1),
    },
  });

  const leadWon = await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: bharat.id,
      ownerId: amit.id,
      source: "REFERRAL",
      status: "WON",
      priority: "MEDIUM",
      title: "Mixed valve order for engineering workshop",
      description: "Referred by an existing customer, deal closed successfully.",
      product: "Mixed valves",
      quantity: "18 pieces",
      estimatedValue: 96000,
      wonAt: daysFromNow(-5),
      createdAt: daysFromNow(-20),
    },
  });

  const leadLost = await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: kiran.id,
      ownerId: sneha.id,
      source: "EXPORTERS_INDIA",
      status: "LOST",
      priority: "MEDIUM",
      title: "Export order for gate valves",
      description: "Competitor quoted a significantly lower price.",
      product: 'Gate Valve 4"',
      quantity: "20 pieces",
      estimatedValue: 61000,
      lostReason: "Lost to competitor on price",
      lostAt: daysFromNow(-8),
      createdAt: daysFromNow(-25),
    },
  });

  const leadOverdueQuote = await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: national.id,
      ownerId: manager.id,
      source: "PHONE",
      status: "QUOTATION_SENT",
      priority: "MEDIUM",
      title: "Fabrication unit valve upgrade",
      description: "Quotation sent, no follow-up done yet.",
      product: 'Butterfly Valve 6"',
      quantity: "6 pieces",
      estimatedValue: 33500,
      nextAction: "Follow up on quotation",
      nextActionDeadline: daysFromNow(-6),
      createdAt: daysFromNow(-18),
    },
  });

  const leadManual = await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: omSai.id,
      ownerId: amit.id,
      source: "MANUAL",
      status: "QUALIFIED",
      priority: "LOW",
      title: "Walk-in enquiry for pressure gauges",
      description: "Customer visited the office directly.",
      product: "Pressure Gauge 100mm",
      quantity: "15 pieces",
      estimatedValue: 9600,
      nextAction: "Prepare and send quotation",
      nextActionDeadline: daysFromNow(2),
      createdAt: daysFromNow(-3),
    },
  });

  const leadPartialViolation = await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: kiran.id,
      ownerId: manager.id,
      source: "TRADEINDIA",
      status: "CONTACTED",
      priority: "MEDIUM",
      title: "Pressure gauges for new dyeing unit",
      description: "Spoke to customer once, forgot to set a next step.",
      product: "Pressure Gauge 100mm",
      quantity: "40 pieces",
      estimatedValue: 24800,
      createdAt: daysFromNow(-6),
    },
  });

  const leadUrgent = await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: bharat.id,
      ownerId: sneha.id,
      source: "REFERRAL",
      status: "NEGOTIATION",
      priority: "URGENT",
      title: "Large gate valve order before plant shutdown",
      description: "Customer needs delivery before their annual maintenance shutdown window.",
      product: 'Gate Valve 4"',
      quantity: "40 pieces",
      estimatedValue: 128000,
      nextAction: "Finalize price and lock delivery date",
      nextActionDeadline: daysFromNow(1),
      createdAt: daysFromNow(-4),
    },
  });

  // ---- Activities ----
  await prisma.activity.createMany({
    data: [
      { leadId: leadOverdue.id, userId: amit.id, type: "WHATSAPP", notes: "Sent product catalogue on WhatsApp.", createdAt: daysFromNow(-13) },
      { leadId: leadOverdue.id, userId: amit.id, type: "STATUS_CHANGE", notes: "Moved to Quotation Sent.", createdAt: daysFromNow(-10) },
      { leadId: leadDueToday.id, userId: sneha.id, type: "CALL", notes: "Discussed pump specs and delivery timeline.", createdAt: daysFromNow(-6) },
      { leadId: leadDueToday.id, userId: sneha.id, type: "EMAIL", notes: "Sent draft quotation for review.", createdAt: daysFromNow(-2) },
      { leadId: leadUpcoming.id, userId: amit.id, type: "CALL", notes: "Introductory call, customer requested drawing.", createdAt: daysFromNow(-2) },
      { leadId: leadWon.id, userId: amit.id, type: "MEETING", notes: "Finalized order at customer's site visit.", createdAt: daysFromNow(-6) },
      { leadId: leadWon.id, userId: amit.id, type: "STATUS_CHANGE", notes: "Marked as Won.", createdAt: daysFromNow(-5) },
      { leadId: leadLost.id, userId: sneha.id, type: "STATUS_CHANGE", notes: "Marked as Lost - competitor pricing.", createdAt: daysFromNow(-8) },
      { leadId: leadPartialViolation.id, userId: manager.id, type: "CALL", notes: "Discussed requirement, customer will confirm quantity.", createdAt: daysFromNow(-6) },
      { leadId: leadUrgent.id, userId: sneha.id, type: "CALL", notes: "Customer confirmed urgency due to shutdown window.", createdAt: daysFromNow(-4) },
      { leadId: leadUrgent.id, userId: sneha.id, type: "EMAIL", notes: "Sent draft pricing, awaiting confirmation.", createdAt: daysFromNow(-1) },
    ],
  });

  // ---- Tasks / Follow-ups ----
  await prisma.task.createMany({
    data: [
      { leadId: leadOverdue.id, assignedToId: amit.id, title: "Call customer to confirm quotation", dueDate: daysFromNow(-3), status: "PENDING" },
      { leadId: leadOverdueQuote.id, assignedToId: manager.id, title: "Follow up on pending quotation", dueDate: daysFromNow(-6), status: "PENDING" },
      { leadId: leadDueToday.id, assignedToId: sneha.id, title: "Send revised pricing", dueDate: daysFromNow(0), status: "PENDING" },
      { leadId: leadUpcoming.id, assignedToId: amit.id, title: "Get technical drawing from customer", dueDate: daysFromNow(4), status: "PENDING" },
      { leadId: leadManual.id, assignedToId: amit.id, title: "Send quotation for pressure gauges", dueDate: daysFromNow(2), status: "PENDING" },
      { leadId: leadWon.id, assignedToId: amit.id, title: "Confirm delivery schedule", dueDate: daysFromNow(-4), status: "COMPLETED", completedAt: daysFromNow(-5) },
      { leadId: leadUrgent.id, assignedToId: sneha.id, title: "Finalize price and lock delivery date", dueDate: daysFromNow(1), status: "PENDING" },
      // Piled onto Amit on purpose: he's the "overloaded salesperson" demo case.
      { leadId: leadOverdue.id, assignedToId: amit.id, title: "Send updated technical drawing", dueDate: daysFromNow(-5), status: "PENDING" },
      { leadId: leadManual.id, assignedToId: amit.id, title: "Chase pending decision on draft quotation", dueDate: daysFromNow(-2), status: "PENDING" },
      { leadId: leadOverdue.id, assignedToId: amit.id, title: "Confirm delivery address", dueDate: daysFromNow(-8), status: "COMPLETED", completedAt: daysFromNow(-7) },
      // Upcoming work for Sneha and Priya, and a second completed task for
      // Sneha, so the queue isn't all overdue.
      { leadId: leadDueToday.id, assignedToId: sneha.id, title: "Send updated commercial terms", dueDate: daysFromNow(2), status: "PENDING" },
      { leadId: leadPartialViolation.id, assignedToId: manager.id, title: "Call to set next steps", dueDate: daysFromNow(1), status: "PENDING" },
      { leadId: leadUrgent.id, assignedToId: sneha.id, title: "Send product catalogue", dueDate: daysFromNow(-3), status: "COMPLETED", completedAt: daysFromNow(-3) },
    ],
  });

  // ---- Quotations ----
  const q1 = await prisma.quotation.create({
    data: {
      leadId: leadOverdue.id,
      companyId: company.id,
      quotationNumber: "QT-2026-0041",
      value: 72500,
      status: "SENT",
      nextAction: "Call to confirm quotation approval",
      sentAt: daysFromNow(-10),
      validUntil: daysFromNow(20),
      followUpDate: daysFromNow(-3),
    },
  });
  await prisma.quotationItem.create({
    data: { quotationId: q1.id, productId: ballValve.id, description: 'Ball Valve 2"', quantity: 50, unitPrice: 1450, total: 72500 },
  });

  const q2 = await prisma.quotation.create({
    data: {
      leadId: leadDueToday.id,
      companyId: company.id,
      quotationNumber: "QT-2026-0044",
      value: 55500,
      status: "FOLLOWED_UP",
      nextAction: "Confirm final pricing with customer",
      sentAt: daysFromNow(-5),
      validUntil: daysFromNow(25),
      followUpDate: daysFromNow(0),
    },
  });
  await prisma.quotationItem.create({
    data: { quotationId: q2.id, productId: pump.id, description: "Centrifugal Pump 5HP", quantity: 3, unitPrice: 18500, total: 55500 },
  });

  const q3 = await prisma.quotation.create({
    data: {
      leadId: leadWon.id,
      companyId: company.id,
      quotationNumber: "QT-2026-0022",
      value: 96000,
      status: "ACCEPTED",
      sentAt: daysFromNow(-15),
      validUntil: daysFromNow(15),
    },
  });
  await prisma.quotationItem.createMany({
    data: [
      { quotationId: q3.id, productId: gateValve.id, description: 'Gate Valve 4"', quantity: 10, unitPrice: 3200, total: 32000 },
      { quotationId: q3.id, productId: butterflyValve.id, description: 'Butterfly Valve 6"', quantity: 8, unitPrice: 5400, total: 43200 },
      { quotationId: q3.id, productId: pressureGauge.id, description: "Pressure Gauge 100mm", quantity: 33, unitPrice: 620, total: 20460 },
    ],
  });

  const q4 = await prisma.quotation.create({
    data: {
      leadId: leadOverdueQuote.id,
      companyId: company.id,
      quotationNumber: "QT-2026-0038",
      value: 33500,
      status: "SENT",
      nextAction: "Follow up on quotation",
      sentAt: daysFromNow(-16),
      validUntil: daysFromNow(14),
      followUpDate: daysFromNow(-6),
    },
  });
  await prisma.quotationItem.create({
    data: { quotationId: q4.id, productId: butterflyValve.id, description: 'Butterfly Valve 6"', quantity: 6, unitPrice: 5400, total: 32400 },
  });

  const q5 = await prisma.quotation.create({
    data: {
      leadId: leadManual.id,
      companyId: company.id,
      quotationNumber: "QT-2026-0047",
      value: 9600,
      status: "DRAFT",
      nextAction: "Finalize pricing before sending",
    },
  });
  await prisma.quotationItem.create({
    data: { quotationId: q5.id, productId: pressureGauge.id, description: "Pressure Gauge 100mm", quantity: 15, unitPrice: 620, total: 9300 },
  });

  const q6 = await prisma.quotation.create({
    data: {
      leadId: leadLost.id,
      companyId: company.id,
      quotationNumber: "QT-2026-0030",
      value: 61000,
      status: "REJECTED",
      sentAt: daysFromNow(-22),
      validUntil: daysFromNow(-2),
      lostAt: daysFromNow(-8),
      lostReason: "Customer went with a cheaper competitor quote.",
    },
  });
  await prisma.quotationItem.create({
    data: { quotationId: q6.id, productId: gateValve.id, description: 'Gate Valve 4"', quantity: 20, unitPrice: 3050, total: 61000 },
  });

  // High-value quotation with no follow-up scheduled and no recent activity —
  // demonstrates that quotation-level risk is tracked separately from lead-level risk.
  const q7 = await prisma.quotation.create({
    data: {
      leadId: leadUrgent.id,
      companyId: company.id,
      quotationNumber: "QT-2026-0033",
      value: 128000,
      status: "SENT",
      sentAt: daysFromNow(-20),
      validUntil: daysFromNow(10),
      updatedAt: daysFromNow(-15),
    },
  });
  await prisma.quotationItem.create({
    data: { quotationId: q7.id, productId: gateValve.id, description: 'Gate Valve 4"', quantity: 40, unitPrice: 3200, total: 128000 },
  });

  // ---- Historical won orders (repeat-order detection needs real order history) ----

  // Ganesh Steel Industries: 2 past orders ~70 days apart, last one 60 days ago
  // (60/70 ≈ 0.86 of the average gap) -> repeat signal "Due Soon".
  await createWonOrder({
    companyId: company.id,
    customerId: ganesh.id,
    ownerId: amit.id,
    title: "Ball valves for plant maintenance stock",
    product: ballValve,
    quantity: "30 pieces",
    value: 43500,
    wonAt: daysFromNow(-130),
    source: "INDIAMART",
    quotationNumber: "QT-2025-0011",
  });
  await createWonOrder({
    companyId: company.id,
    customerId: ganesh.id,
    ownerId: amit.id,
    title: "Gate valves for line extension",
    product: gateValve,
    quantity: "15 pieces",
    value: 48000,
    wonAt: daysFromNow(-60),
    source: "INDIAMART",
    quotationNumber: "QT-2025-0019",
  });

  // Bharat Engineering Corporation: 2 earlier orders on top of the existing
  // recent one (5 days ago) -> average gap ~47 days, last order 5 days ago
  // -> repeat signal "Normal" (a healthy, recently-active repeat customer).
  await createWonOrder({
    companyId: company.id,
    customerId: bharat.id,
    ownerId: amit.id,
    title: "Gate valves for workshop retrofit",
    product: gateValve,
    quantity: "25 pieces",
    value: 62000,
    wonAt: daysFromNow(-100),
    source: "REFERRAL",
    quotationNumber: "QT-2025-0014",
  });
  await createWonOrder({
    companyId: company.id,
    customerId: bharat.id,
    ownerId: amit.id,
    title: "Butterfly valves for cooling line",
    product: butterflyValve,
    quantity: "20 pieces",
    value: 74000,
    wonAt: daysFromNow(-50),
    source: "REFERRAL",
    quotationNumber: "QT-2025-0021",
  });

  // Kiran Textile Mills: 2 orders ~70 days apart, last one 100 days ago
  // (100/70 ≈ 1.43 of the average gap) -> repeat signal "Repeat Order Due".
  await createWonOrder({
    companyId: company.id,
    customerId: kiran.id,
    ownerId: sneha.id,
    title: "Ball valves for dyeing unit",
    product: ballValve,
    quantity: "60 pieces",
    value: 87000,
    wonAt: daysFromNow(-170),
    source: "JUSTDIAL",
    quotationNumber: "QT-2025-0009",
  });
  await createWonOrder({
    companyId: company.id,
    customerId: kiran.id,
    ownerId: sneha.id,
    title: "Gate valves for boiler house",
    product: gateValve,
    quantity: "22 pieces",
    value: 68200,
    wonAt: daysFromNow(-100),
    source: "JUSTDIAL",
    quotationNumber: "QT-2025-0016",
  });

  // Vikram Pumps & Fittings: 3 orders ~85 days apart on average, but nothing
  // in 150 days and no active leads -> "Dormant" customer, repeat signal
  // "Overdue / Dormant", and high total value -> the flagship demo customer
  // for "previously high-value customer has gone inactive".
  await createWonOrder({
    companyId: company.id,
    customerId: vikram.id,
    ownerId: sneha.id,
    title: "Centrifugal pumps for cooling tower",
    product: pump,
    quantity: "4 units",
    value: 76000,
    wonAt: daysFromNow(-320),
    source: "REFERRAL",
    quotationNumber: "QT-2025-0002",
  });
  await createWonOrder({
    companyId: company.id,
    customerId: vikram.id,
    ownerId: sneha.id,
    title: "Centrifugal pumps for expansion line",
    product: pump,
    quantity: "5 units",
    value: 95000,
    wonAt: daysFromNow(-230),
    source: "REFERRAL",
    quotationNumber: "QT-2025-0006",
  });
  await createWonOrder({
    companyId: company.id,
    customerId: vikram.id,
    ownerId: sneha.id,
    title: "Pressure gauges for pump stations",
    product: pressureGauge,
    quantity: "60 pieces",
    value: 39000,
    wonAt: daysFromNow(-150),
    source: "REFERRAL",
    quotationNumber: "QT-2025-0012",
  });

  // Deccan Steel Traders: a single lost enquiry, nothing won and nothing
  // active -> customer status "Lost".
  const leadDeccanLost = await prisma.lead.create({
    data: {
      companyId: company.id,
      customerId: deccan.id,
      ownerId: manager.id,
      source: "EMAIL",
      status: "LOST",
      priority: "LOW",
      title: "Butterfly valves for cooling tower retrofit",
      description: "Enquiry followed up but budget was deferred to next fiscal year.",
      product: 'Butterfly Valve 6"',
      quantity: "10 pieces",
      estimatedValue: 27000,
      lostReason: "Budget approved for next fiscal year only.",
      lostAt: daysFromNow(-40),
      createdAt: daysFromNow(-50),
    },
  });
  await prisma.activity.create({
    data: {
      leadId: leadDeccanLost.id,
      userId: manager.id,
      type: "STATUS_CHANGE",
      notes: "Marked as Lost - budget deferred to next fiscal year.",
      createdAt: daysFromNow(-40),
    },
  });

  // ---- Integrations ----
  // Real API connectors with no adapter yet stay Coming Soon; IndiaMART and
  // Website Forms have webhook adapters (Phase 8) but aren't set up until an
  // Owner/Manager generates a webhook from the Integrations page, so they
  // seed as Requires Setup. CSV import and manual entry just work.
  await prisma.integration.createMany({
    data: [
      { companyId: company.id, type: "INDIAMART", status: "REQUIRES_SETUP" },
      { companyId: company.id, type: "JUSTDIAL", status: "COMING_SOON" },
      { companyId: company.id, type: "EXPORTERS_INDIA", status: "COMING_SOON" },
      { companyId: company.id, type: "TRADEINDIA", status: "COMING_SOON" },
      { companyId: company.id, type: "WHATSAPP", status: "COMING_SOON" },
      { companyId: company.id, type: "EMAIL", status: "COMING_SOON" },
      { companyId: company.id, type: "WEBSITE", status: "REQUIRES_SETUP" },
      { companyId: company.id, type: "CSV_IMPORT", status: "CONNECTED", enabled: true },
      { companyId: company.id, type: "MANUAL", status: "CONNECTED", enabled: true },
    ],
  });

  // ---- Notifications ----
  // A representative sample referencing real seeded records, in the same
  // vocabulary the runtime sync service (src/server/data/notifications.ts)
  // uses. The app generates any further missing ones live on first load —
  // seeding these just gives a realistic starting inbox with read/unread mix.
  await prisma.notification.createMany({
    data: [
      {
        companyId: company.id,
        userId: sneha.id,
        type: "NEW_LEAD_ASSIGNED",
        message: `Lead assigned to you: "${leadUrgent.title}"`,
        entityType: "Lead",
        entityId: leadUrgent.id,
        isRead: false,
      },
      {
        companyId: company.id,
        userId: sneha.id,
        type: "FOLLOW_UP_DUE",
        message: `Follow-up due today: "Send revised pricing"`,
        entityType: "Lead",
        entityId: leadDueToday.id,
        isRead: false,
      },
      {
        companyId: company.id,
        userId: amit.id,
        type: "FOLLOW_UP_OVERDUE",
        message: `Follow-up overdue: "Call customer to confirm quotation"`,
        entityType: "Lead",
        entityId: leadOverdue.id,
        isRead: false,
      },
      {
        companyId: company.id,
        userId: amit.id,
        type: "QUOTATION_OVERDUE",
        message: `Quotation follow-up overdue: ${q1.quotationNumber} (${ganesh.name})`,
        entityType: "Quotation",
        entityId: q1.id,
        isRead: false,
      },
      {
        companyId: company.id,
        userId: manager.id,
        type: "MISSING_NEXT_ACTION",
        message: `Lead needs a next action: "${leadPartialViolation.title}"`,
        entityType: "Lead",
        entityId: leadPartialViolation.id,
        isRead: false,
      },
      {
        companyId: company.id,
        userId: amit.id,
        type: "HIGH_VALUE_ATTENTION",
        message: `High-value opportunity needs attention: "${leadOverdue.title}"`,
        entityType: "Lead",
        entityId: leadOverdue.id,
        isRead: true,
      },
      {
        companyId: company.id,
        userId: sneha.id,
        type: "REPEAT_ORDER",
        message: `Possible repeat-order opportunity: ${vikram.name}`,
        entityType: "Customer",
        entityId: vikram.id,
        isRead: false,
      },
      {
        companyId: company.id,
        userId: owner.id,
        type: "HIGH_VALUE_ATTENTION",
        message: `High-value quotation stalled: ${q7.quotationNumber} (${bharat.name}, ₹1,28,000)`,
        entityType: "Quotation",
        entityId: q7.id,
        isRead: false,
      },
    ],
  });

  // ---- Audit log ----
  await prisma.auditLog.createMany({
    data: [
      { companyId: company.id, userId: amit.id, action: "LEAD_CREATED", entityType: "Lead", entityId: leadOverdue.id },
      { companyId: company.id, userId: amit.id, action: "STATUS_CHANGED", entityType: "Lead", entityId: leadWon.id, metadata: JSON.stringify({ from: "NEGOTIATION", to: "WON" }) },
      { companyId: company.id, userId: sneha.id, action: "STATUS_CHANGED", entityType: "Lead", entityId: leadLost.id, metadata: JSON.stringify({ from: "NEGOTIATION", to: "LOST", reason: "Lost to competitor on price" }) },
    ],
  });

  // =========================================================================
  // ---- SECOND DEMO COMPANY (proves tenant isolation) ----
  // A smaller, completely separate fictional company — own users, customers,
  // leads, quotations, tasks, notifications. None of it references anything
  // from Shree Balaji above; that's the point.
  // =========================================================================

  const company2 = await prisma.company.create({
    data: {
      name: "Om Precision Tools & Dies Pvt. Ltd.",
      city: "Coimbatore",
      state: "Tamil Nadu",
      industry: "Precision Tooling & Die Manufacturing",
      phone: "+91 4224567890",
      email: "info@omprecision.in",
      onboardedAt: new Date(),
    },
  });
  await prisma.subscription.create({
    data: { companyId: company2.id, plan: "FOUNDING", status: "ACTIVE", currentPeriodStart: new Date() },
  });

  const owner2 = await prisma.user.create({
    data: { companyId: company2.id, name: "Vikas Rao", email: "vikas@omprecision.in", role: "OWNER", passwordHash },
  });
  const manager2 = await prisma.user.create({
    data: { companyId: company2.id, name: "Meena Iyer", email: "meena@omprecision.in", role: "SALES_MANAGER", passwordHash },
  });
  const arjun = await prisma.user.create({
    data: { companyId: company2.id, name: "Arjun Nair", email: "arjun@omprecision.in", role: "SALESPERSON", passwordHash },
  });

  const [dieSet, cncComponent] = await Promise.all([
    prisma.product.create({ data: { companyId: company2.id, name: "Precision Die Set", sku: "PDS-01", unit: "set", defaultPrice: 145000 } }),
    prisma.product.create({ data: { companyId: company2.id, name: "CNC Turned Component", sku: "CTC-02", unit: "piece", defaultPrice: 850 } }),
    prisma.product.create({ data: { companyId: company2.id, name: "Injection Mold Tool", sku: "IMT-03", unit: "set", defaultPrice: 320000 } }),
    prisma.product.create({ data: { companyId: company2.id, name: "Jig & Fixture", sku: "JGF-04", unit: "piece", defaultPrice: 42000 } }),
  ]);

  const company2Customers = await Promise.all(
    [
      { name: "Coastal Auto Components", city: "Chennai", state: "Tamil Nadu", contactPerson: "Suresh Babu" },
      { name: "Sundar Precision Engineering", city: "Coimbatore", state: "Tamil Nadu", contactPerson: "Lakshmi Sundaram" },
      { name: "Metro Plastics Industries", city: "Bengaluru", state: "Karnataka", contactPerson: "Farhan Sheikh" },
    ].map((c) =>
      prisma.customer.create({
        data: {
          companyId: company2.id,
          name: c.name,
          companyName: c.name,
          contactPerson: c.contactPerson,
          phone: "+91 9" + Math.floor(100000000 + Math.random() * 899999999),
          email: c.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "") + "@example.in",
          city: c.city,
          state: c.state,
          gstNumber: "33AAAAA0000A1Z" + Math.floor(Math.random() * 9),
        },
      })
    )
  );
  const [coastalAuto, sundarPrecision, metroPlastics] = company2Customers;

  const c2LeadOpen = await prisma.lead.create({
    data: {
      companyId: company2.id,
      customerId: coastalAuto.id,
      ownerId: arjun.id,
      source: "INDIAMART",
      status: "QUOTATION_SENT",
      priority: "HIGH",
      title: "Precision die set for bumper bracket line",
      description: "Quotation sent for a new die set, follow-up pending.",
      product: "Precision Die Set",
      quantity: "2 sets",
      estimatedValue: 290000,
      nextAction: "Call to confirm tooling drawing approval",
      nextActionDeadline: daysFromNow(-2),
      createdAt: daysFromNow(-12),
    },
  });

  const c2LeadNew = await prisma.lead.create({
    data: {
      companyId: company2.id,
      customerId: metroPlastics.id,
      ownerId: arjun.id,
      source: "JUSTDIAL",
      status: "NEW",
      priority: "MEDIUM",
      title: "Injection mold tool enquiry for new packaging line",
      description: "Enquiry received, not yet contacted.",
      product: "Injection Mold Tool",
      quantity: "1 set",
      estimatedValue: 320000,
      createdAt: daysFromNow(-1),
    },
  });

  const c2LeadNoNextAction = await prisma.lead.create({
    data: {
      companyId: company2.id,
      customerId: sundarPrecision.id,
      ownerId: manager2.id,
      source: "REFERRAL",
      status: "CONTACTED",
      priority: "MEDIUM",
      title: "CNC turned components for hydraulic fittings",
      description: "Spoke once, requirement still being finalized by customer.",
      product: "CNC Turned Component",
      quantity: "5,000 pieces",
      estimatedValue: 42500,
      createdAt: daysFromNow(-5),
    },
  });

  const c2LeadLost = await prisma.lead.create({
    data: {
      companyId: company2.id,
      customerId: metroPlastics.id,
      ownerId: arjun.id,
      source: "EMAIL",
      status: "LOST",
      priority: "LOW",
      title: "Jig fixture for assembly line upgrade",
      description: "Customer deferred the project indefinitely.",
      product: "Jig & Fixture",
      quantity: "6 pieces",
      estimatedValue: 25200,
      lostReason: "Project deferred by customer.",
      lostAt: daysFromNow(-15),
      createdAt: daysFromNow(-30),
    },
  });

  await createWonOrder({
    companyId: company2.id,
    customerId: sundarPrecision.id,
    ownerId: manager2.id,
    title: "CNC turned components — repeat production run",
    product: cncComponent,
    quantity: "8,000 pieces",
    value: 68000,
    wonAt: daysFromNow(-40),
    source: "REFERRAL",
    quotationNumber: "OMP-2025-0031",
  });

  await prisma.activity.createMany({
    data: [
      { leadId: c2LeadOpen.id, userId: arjun.id, type: "WHATSAPP", notes: "Shared tooling drawing for review.", createdAt: daysFromNow(-9) },
      { leadId: c2LeadOpen.id, userId: arjun.id, type: "STATUS_CHANGE", notes: "Moved to Quotation Sent.", createdAt: daysFromNow(-6) },
      { leadId: c2LeadNoNextAction.id, userId: manager2.id, type: "CALL", notes: "Discussed volumes, customer to confirm spec.", createdAt: daysFromNow(-5) },
      { leadId: c2LeadLost.id, userId: arjun.id, type: "STATUS_CHANGE", notes: "Marked as Lost - project deferred.", createdAt: daysFromNow(-15) },
    ],
  });

  await prisma.task.createMany({
    data: [
      { leadId: c2LeadOpen.id, assignedToId: arjun.id, title: "Call to confirm tooling drawing approval", dueDate: daysFromNow(-2), status: "PENDING" },
      { leadId: c2LeadNew.id, assignedToId: arjun.id, title: "Make first contact call", dueDate: daysFromNow(1), status: "PENDING" },
      { leadId: c2LeadNoNextAction.id, assignedToId: manager2.id, title: "Follow up on finalized spec", dueDate: daysFromNow(3), status: "PENDING" },
    ],
  });

  const c2Quotation = await prisma.quotation.create({
    data: {
      leadId: c2LeadOpen.id,
      companyId: company2.id,
      quotationNumber: "OMP-2025-0044",
      value: 290000,
      status: "SENT",
      nextAction: "Call to confirm tooling drawing approval",
      sentAt: daysFromNow(-9),
      validUntil: daysFromNow(21),
      followUpDate: daysFromNow(-2),
    },
  });
  await prisma.quotationItem.create({
    data: { quotationId: c2Quotation.id, productId: dieSet.id, description: "Precision Die Set", quantity: 2, unitPrice: 145000, total: 290000 },
  });

  await prisma.integration.createMany({
    data: [
      { companyId: company2.id, type: "INDIAMART", status: "REQUIRES_SETUP" },
      { companyId: company2.id, type: "JUSTDIAL", status: "COMING_SOON" },
      { companyId: company2.id, type: "EXPORTERS_INDIA", status: "COMING_SOON" },
      { companyId: company2.id, type: "TRADEINDIA", status: "COMING_SOON" },
      { companyId: company2.id, type: "WHATSAPP", status: "COMING_SOON" },
      { companyId: company2.id, type: "EMAIL", status: "COMING_SOON" },
      { companyId: company2.id, type: "WEBSITE", status: "REQUIRES_SETUP" },
      { companyId: company2.id, type: "CSV_IMPORT", status: "CONNECTED", enabled: true },
      { companyId: company2.id, type: "MANUAL", status: "CONNECTED", enabled: true },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        companyId: company2.id,
        userId: arjun.id,
        type: "QUOTATION_OVERDUE",
        message: `Quotation follow-up overdue: ${c2Quotation.quotationNumber} (${coastalAuto.name})`,
        entityType: "Quotation",
        entityId: c2Quotation.id,
        isRead: false,
      },
      {
        companyId: company2.id,
        userId: manager2.id,
        type: "MISSING_NEXT_ACTION",
        message: `Lead needs a next action: "${c2LeadNoNextAction.title}"`,
        entityType: "Lead",
        entityId: c2LeadNoNextAction.id,
        isRead: false,
      },
    ],
  });

  await prisma.auditLog.create({
    data: { companyId: company2.id, userId: owner2.id, action: "LEAD_CREATED", entityType: "Lead", entityId: c2LeadOpen.id },
  });

  console.log("Seed complete:");
  console.log(`  Company 1: ${company.name}`);
  console.log(`  Users: 4, Customers: ${customers.length}, Products: 5`);
  console.log(`  Leads: 21, Quotations: 16, Tasks: 13, Activities: 30, Notifications: 8`);
  console.log(`  Company 2: ${company2.name}`);
  console.log(`  Users: 3, Customers: 3, Products: 4, Leads: 5, Quotations: 2, Tasks: 3`);
  console.log(`  Demo password for every account: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
