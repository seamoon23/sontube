import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
] as const;

const restrictedRouteHeaders = [
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
  },
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0, must-revalidate",
  },
] as const;

const restrictedRouteSources = [
  "/admin/:path*",
  "/superadmin/:path*",
  "/app/:path*",
  "/kids/:path*",
  // Keep every API private by default except the explicitly public Lite API.
  "/api/((?!lite(?:/|$)).*)",
] as const;

const publicLiteApiHeaders = [
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
  },
] as const;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
      ...restrictedRouteSources.map((source) => ({
        source,
        headers: [...restrictedRouteHeaders],
      })),
      {
        // Cache policy is status-aware in the route handler: successful
        // catalogs are public, while transient failures are never cached.
        source: "/api/lite/:path*",
        headers: [...publicLiteApiHeaders],
      },
    ];
  },
};

export default nextConfig;
