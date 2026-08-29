import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import nextConfig from "@/next.config";

const restrictedSources = [
  "/admin/:path*",
  "/superadmin/:path*",
  "/app/:path*",
  "/kids/:path*",
  "/api/:path*",
];

describe("web exposure guards", () => {
  it("disallows sensitive route families in robots.txt", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/superadmin", "/app", "/kids", "/api"],
      },
    });
  });

  it("sets no-index and no-store headers on every sensitive route family", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");

    const headerRules = await nextConfig.headers!();

    for (const source of restrictedSources) {
      const rule = headerRules.find((candidate) => candidate.source === source);

      expect(rule?.headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "X-Robots-Tag", value: expect.stringContaining("noindex") }),
          expect.objectContaining({ key: "Cache-Control", value: expect.stringContaining("no-store") }),
        ]),
      );
    }
  });

  it("keeps the global browser security headers", async () => {
    const headerRules = await nextConfig.headers!();
    const globalRule = headerRules.find((candidate) => candidate.source === "/:path*");

    expect(globalRule?.headers).toEqual(
      expect.arrayContaining([
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ]),
    );
  });
});
