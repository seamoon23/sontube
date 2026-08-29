import { describe, expect, it } from "vitest";
import {
  createHashedRateLimitIdentifier,
  getMvpTrustedProxyClientIp,
  ProcessLocalFixedWindowRateLimiter,
} from "@/lib/rate-limit";

describe("ProcessLocalFixedWindowRateLimiter", () => {
  it("allows the configured count and resets only after the fixed window", () => {
    const limiter = new ProcessLocalFixedWindowRateLimiter({
      windowMs: 1_000,
      maxRequests: 2,
      maxBuckets: 10,
    });

    expect(limiter.allow("parent", 100)).toBe(true);
    expect(limiter.allow("parent", 999)).toBe(true);
    expect(limiter.allow("parent", 1_099)).toBe(false);
    expect(limiter.allow("parent", 1_100)).toBe(true);
  });

  it("bounds live buckets and fails closed for a new identifier at capacity", () => {
    const limiter = new ProcessLocalFixedWindowRateLimiter({
      windowMs: 1_000,
      maxRequests: 2,
      maxBuckets: 2,
    });

    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("b", 0)).toBe(true);
    expect(limiter.allow("c", 1)).toBe(false);
    expect(limiter.bucketCount).toBe(2);
    expect(limiter.allow("a", 1)).toBe(true);
  });

  it("cleans expired buckets before admitting a new identifier", () => {
    const limiter = new ProcessLocalFixedWindowRateLimiter({
      windowMs: 100,
      maxRequests: 1,
      maxBuckets: 10,
    });

    limiter.allow("a", 0);
    limiter.allow("b", 50);

    expect(limiter.allow("c", 100)).toBe(true);
    expect(limiter.bucketCount).toBe(2);
    expect(limiter.allow("d", 200)).toBe(true);
    expect(limiter.bucketCount).toBe(1);
  });

  it("can remove a successful-login bucket explicitly", () => {
    const limiter = new ProcessLocalFixedWindowRateLimiter({
      windowMs: 1_000,
      maxRequests: 1,
      maxBuckets: 1,
    });

    expect(limiter.allow("login", 0)).toBe(true);
    limiter.delete("login");
    expect(limiter.allow("next-login", 1)).toBe(true);
  });
});

describe("rate-limit identifiers", () => {
  it("uses unambiguous length-prefixed hashing", () => {
    expect(createHashedRateLimitIdentifier(["ab", "c"])).not.toBe(
      createHashedRateLimitIdentifier(["a", "bc"]),
    );
    expect(createHashedRateLimitIdentifier(["ip", "email"])).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("reads the first trusted proxy address with bounded fallbacks", () => {
    expect(getMvpTrustedProxyClientIp(new Headers({ "x-forwarded-for": " 203.0.113.1, 10.0.0.1" }))).toBe(
      "203.0.113.1",
    );
    expect(getMvpTrustedProxyClientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe(
      "198.51.100.2",
    );
    expect(getMvpTrustedProxyClientIp(new Headers())).toBe("local");
    expect(getMvpTrustedProxyClientIp(new Headers({ "x-real-ip": "x".repeat(129) }))).toBe("local");
  });
});
