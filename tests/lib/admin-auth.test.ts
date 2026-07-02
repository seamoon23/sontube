import { describe, expect, it } from "vitest";
import {
  createAdminSessionToken,
  hashAdminPassword,
  isAdminAuthConfigured,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "@/lib/admin-auth";

describe("admin auth helpers", () => {
  it("detects whether admin auth environment is configured", () => {
    expect(isAdminAuthConfigured({})).toBe(false);
    expect(
      isAdminAuthConfigured({
        ADMIN_PASSWORD_HASH: "abc",
        SESSION_SECRET: "secret",
      }),
    ).toBe(true);
  });

  it("hashes and verifies an admin password without storing plain text", () => {
    const secret = "local-secret";
    const hash = hashAdminPassword("parent-pass", secret);

    expect(hash).not.toContain("parent-pass");
    expect(verifyAdminPassword("parent-pass", hash, secret)).toBe(true);
    expect(verifyAdminPassword("wrong-pass", hash, secret)).toBe(false);
  });

  it("creates signed session tokens and rejects tampered or expired tokens", () => {
    const secret = "session-secret";
    const issuedAt = new Date("2026-07-02T00:00:00Z");
    const token = createAdminSessionToken(secret, issuedAt);

    expect(verifyAdminSessionToken(token, secret, new Date("2026-07-03T00:00:00Z"))).toBe(true);
    expect(verifyAdminSessionToken(`${token}x`, secret, new Date("2026-07-03T00:00:00Z"))).toBe(false);
    expect(verifyAdminSessionToken(token, secret, new Date("2026-07-12T00:00:00Z"))).toBe(false);
  });
});
