import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/*/admin/*", "/*/checkout/success", "/*/checkout/cancel"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
