import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site/seo";

// Allow everything. The product under /app is a public demo the marketing
// page links to directly, it runs on clearly labeled fictional sample data,
// and there is nothing sensitive behind it, so there is no reason to
// disallow crawlers anywhere.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
