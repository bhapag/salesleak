import type { EmailPayload } from "./email";

/** Mock inbound emails for exercising parseEmailPayload() in development — no live inbox involved. */
export const EMAIL_FIXTURES: EmailPayload[] = [
  {
    from: "Suresh Nair <suresh.nair@nairhydraulics.example.in>",
    to: "sales@yourcompany.example.in",
    subject: "Enquiry: Hydraulic cylinders for press machine",
    body: "Hello,\n\nWe need 8 hydraulic cylinders (bore 80mm, stroke 300mm) for a press machine retrofit. Please share your best quote and lead time.\n\nRegards,\nSuresh",
    receivedAt: new Date().toISOString(),
  },
  {
    from: "procurement@bhardwajforge.example.in",
    to: "sales@yourcompany.example.in",
    subject: "RFQ - Forged Flanges",
    body: "Requesting a quote for 200 forged flanges, class 150, size 4 inch. Please respond with pricing and delivery timeline.",
    receivedAt: new Date().toISOString(),
  },
  {
    from: "not-an-email-header-at-all",
    to: "sales@yourcompany.example.in",
    subject: "",
    body: "This fixture intentionally has an unparseable sender to exercise the failure path.",
    receivedAt: new Date().toISOString(),
  },
];
