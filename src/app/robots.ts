import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/public-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicAppUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/logements", "/privacy"],
        disallow: ["/admin", "/dashboard", "/prospects", "/matches", "/marketing", "/visits", "/placements", "/commissions", "/settings", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
