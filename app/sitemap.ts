import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site/seo";

// Two URLs only. The six product screens under /app (exposure, graph, radar,
// portfolio, resolve, hindsight) are deliberately excluded: they are demo
// states of one prototype running on fictional sample data, gated client-side
// and reached from /app, so /app is the single canonical product entry and
// indexing the states separately would only surface fictional demo data in
// search results.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/app`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
