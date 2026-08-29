import type { MetadataRoute } from "next";

const restrictedPaths = ["/admin", "/superadmin", "/app", "/kids", "/api"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: restrictedPaths,
    },
  };
}
