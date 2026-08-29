import { createHash } from "node:crypto";

type ProcessLocalFixedWindowRateLimiterOptions = {
  windowMs: number;
  maxRequests: number;
  maxBuckets: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type HeaderReader = {
  get(name: string): string | null;
};

/**
 * A deliberately process-local MVP limiter. It bounds memory, but it does not
 * coordinate attempts across multiple Node processes or survive restarts.
 */
export class ProcessLocalFixedWindowRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private nextCleanupAt = 0;

  constructor(private readonly options: ProcessLocalFixedWindowRateLimiterOptions) {
    assertPositiveInteger(options.windowMs, "windowMs");
    assertPositiveInteger(options.maxRequests, "maxRequests");
    assertPositiveInteger(options.maxBuckets, "maxBuckets");
  }

  allow(identifier: string, now = Date.now()): boolean {
    if (!identifier) return false;

    if (now >= this.nextCleanupAt || this.buckets.size >= this.options.maxBuckets) {
      this.removeExpiredBuckets(now);
    }

    const bucket = this.buckets.get(identifier);
    if (!bucket) {
      // Fail closed for previously unseen identifiers instead of evicting a live
      // bucket and letting a key-churn attacker reset somebody else's window.
      if (this.buckets.size >= this.options.maxBuckets) return false;

      this.buckets.set(identifier, {
        count: 1,
        resetAt: now + this.options.windowMs,
      });
      return true;
    }

    if (bucket.resetAt <= now) {
      bucket.count = 1;
      bucket.resetAt = now + this.options.windowMs;
      return true;
    }

    if (bucket.count >= this.options.maxRequests) return false;
    bucket.count += 1;
    return true;
  }

  delete(identifier: string): void {
    this.buckets.delete(identifier);
  }

  get bucketCount(): number {
    return this.buckets.size;
  }

  private removeExpiredBuckets(now: number): void {
    for (const [identifier, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(identifier);
    }

    this.nextCleanupAt = now + Math.min(this.options.windowMs, 60_000);
  }
}

export function createHashedRateLimitIdentifier(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(String(Buffer.byteLength(part, "utf8")));
    hash.update(":");
    hash.update(part);
    hash.update("|");
  }
  return hash.digest("hex");
}

/**
 * MVP-only proxy identity lookup. The deployment proxy must discard incoming
 * forwarding headers and set its own trusted values before this is security-relevant.
 */
export function getMvpTrustedProxyClientIp(requestHeaders: HeaderReader): string {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const realIp = requestHeaders.get("x-real-ip")?.trim();
  const candidate = forwarded || realIp;

  return candidate && candidate.length <= 128 ? candidate : "local";
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer.`);
  }
}
