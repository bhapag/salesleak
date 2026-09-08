import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/appUrl";

/**
 * Default-deny, explicit-allow — deliberately the opposite of a Disallow
 * list. The authenticated app has no shared URL prefix to block in one rule
 * (the (app) route group doesn't add a path segment, so the Dashboard,
 * Leads, Customers, etc. all sit at bare top-level paths like everything
 * public does), so enumerating every private route would be one missed
 * addition away from leaking a new page into search results. Blocking
 * everything except the small, fixed set of genuinely public pages doesn't
 * have that failure mode.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/welcome", "/terms", "/privacy", "/login", "/signup"],
      disallow: "/",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
