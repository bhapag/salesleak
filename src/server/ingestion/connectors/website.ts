import type { ProviderAdapter, ParseResult } from "./types";

/**
 * Payload shape posted by the public website-form demo page
 * (src/app/website-form/[token]/page.tsx) and by any real embeddable form
 * a company builds against the same webhook endpoint.
 */
export type WebsiteFormPayload = {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  city?: string;
  product?: string;
  requirement?: string;
  quantity?: string;
  estimatedValue?: string | number;
  sourcePage?: string;
};

function parseWebsiteFormPayload(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Payload must be a JSON object." };
  }
  const payload = raw as WebsiteFormPayload;

  const customerName = (payload.name || payload.company || "").trim();
  if (!customerName) {
    return { ok: false, error: "Missing name/company — the form must collect who is asking." };
  }

  const rawValue = payload.estimatedValue;
  const value = rawValue === "" || rawValue == null ? NaN : typeof rawValue === "number" ? rawValue : Number(rawValue);

  return {
    ok: true,
    input: {
      source: "WEBSITE",
      customerName,
      companyName: payload.company || null,
      phone: payload.phone || null,
      email: payload.email || null,
      city: payload.city || null,
      product: payload.product || null,
      requirement: payload.requirement || null,
      quantity: payload.quantity || null,
      estimatedValue: Number.isFinite(value) ? value : null,
      rawData: JSON.stringify({ ...payload, sourcePage: payload.sourcePage || null }),
    },
  };
}

function sampleWebsiteFormPayload(): WebsiteFormPayload {
  return {
    name: "Anita Deshpande",
    company: "Deshpande Engineering Works",
    phone: "9845012233",
    email: "anita@deshpandeengg.example.in",
    city: "Aurangabad",
    product: "Centrifugal Pump",
    requirement: "Looking for 5HP centrifugal pumps for a bottling line, need a quote.",
    quantity: "10 units",
    estimatedValue: 180000,
    sourcePage: "/contact-us (test)",
  };
}

export const websiteFormAdapter: ProviderAdapter = {
  type: "WEBSITE",
  slug: "website",
  parse: parseWebsiteFormPayload,
  samplePayload: sampleWebsiteFormPayload,
};
