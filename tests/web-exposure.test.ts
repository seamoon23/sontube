import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { metadata, viewport } from "@/app/layout";
import robots from "@/app/robots";
import nextConfig from "@/next.config";

const restrictedSources = [
  "/admin/:path*",
  "/superadmin/:path*",
  "/app/:path*",
  "/kids/:path*",
  "/api/((?!lite(?:/|$)).*)",
];

describe("web exposure guards", () => {
  it("disallows sensitive route families in robots.txt", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: ["/", "/lite", "/api/lite"],
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

  it("leaves status-aware Lite caching to the read-only route handler", async () => {
    const headerRules = await nextConfig.headers!();
    const liteApiRule = headerRules.at(-1);

    expect(liteApiRule?.source).toBe("/api/lite/:path*");
    expect(liteApiRule?.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "X-Robots-Tag", value: expect.stringContaining("noindex") }),
      ]),
    );
    expect(liteApiRule?.headers).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "Cache-Control" })]),
    );
  });

  it("keeps the installable web app inside the public Lite route", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "public/manifest.webmanifest"), "utf8"),
    ) as {
      id?: unknown;
      start_url?: unknown;
      scope?: unknown;
      lang?: unknown;
      icons?: unknown;
    };

    expect(manifest).toMatchObject({
      id: "/lite",
      start_url: "/lite",
      scope: "/lite",
      lang: "ko",
      icons: [
        {
          src: "/sontube-lite-icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    });
  });

  it("exposes the SonTube icon and light mobile browser chrome metadata", () => {
    expect(metadata).toMatchObject({
      applicationName: "SonTube",
      icons: {
        icon: [{ url: "/sontube-lite-icon.svg", type: "image/svg+xml", sizes: "any" }],
      },
    });
    expect(viewport).toMatchObject({ colorScheme: "light", themeColor: "#0369a1" });
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
