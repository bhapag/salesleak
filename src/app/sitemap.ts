import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/appUrl";

/**
 * Only genuinely public, content-bearing pages — not login/signup (real
 * pages, allowed for crawling via robots.ts, but transactional rather than
 * content worth prioritizing here) and not any authenticated app route.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppBaseUrl();

  return [
    { url: `${baseUrl}/welcome`, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
