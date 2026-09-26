import type { MetadataRoute } from "next";

const restrictedPaths = ["/admin", "/superadmin", "/app", "/kids", "/api"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Lite stays crawlable so crawlers can read its noindex directives.
      // The more-specific API allow overrides the general /api block.
      allow: ["/", "/lite", "/api/lite"],
      disallow: restrictedPaths,
    },
  };
}
