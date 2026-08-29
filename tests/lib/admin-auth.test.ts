import { describe, expect, it } from "vitest";
import {
  ADMIN_IMPERSONATION_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  createImpersonatedAdminSessionToken,
  hashAdminPassword,
  isAdminAuthConfigured,
  parseAdminSessionToken,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "@/lib/admin-auth";

const identity = {
  userId: "parent_1",
  familyId: "family_1",
  email: "parent@example.com",
  displayName: "테스트 부모",
};

describe("admin auth helpers", () => {
  it("detects whether parent session signing is configured", () => {
    expect(isAdminAuthConfigured({})).toBe(false);
    expect(isAdminAuthConfigured({ SESSION_SECRET: "secret" })).toBe(true);
  });

  it("hashes and verifies a parent password without storing plain text", () => {
    const secret = "local-secret";
    const hash = hashAdminPassword("parent-pass", secret);

    expect(hash).not.toContain("parent-pass");
    expect(verifyAdminPassword("parent-pass", hash, secret)).toBe(true);
    expect(verifyAdminPassword("wrong-pass", hash, secret)).toBe(false);
    expect(verifyAdminPassword("parent-pass", "not-a-valid-hash", secret)).toBe(false);
  });

  it("round-trips the signed parent identity and rejects tampering or expiry", () => {
    const secret = "session-secret";
    const issuedAt = new Date("2026-07-02T00:00:00Z");
    const token = createAdminSessionToken(secret, identity, issuedAt);

    expect(
      parseAdminSessionToken(token, secret, new Date("2026-07-03T00:00:00Z")),
    ).toEqual({
      ...identity,
      issuedAt: issuedAt.getTime(),
    });
    expect(
      verifyAdminSessionToken(`${token}x`, secret, new Date("2026-07-03T00:00:00Z")),
    ).toBe(false);
    expect(
      verifyAdminSessionToken(token, secret, new Date("2026-07-12T00:00:00Z")),
    ).toBe(false);
  });

  it("limits impersonated parent sessions to thirty minutes", () => {
    const secret = "session-secret";
    const issuedAt = new Date("2026-07-02T00:00:00Z");
    const token = createImpersonatedAdminSessionToken(secret, identity, "owner", issuedAt);

    expect(ADMIN_IMPERSONATION_SESSION_MAX_AGE_SECONDS).toBe(30 * 60);
    expect(
      parseAdminSessionToken(token, secret, new Date("2026-07-02T00:29:59Z")),
    ).toMatchObject({
      ...identity,
      impersonatedBy: "owner",
    });
    expect(
      verifyAdminSessionToken(token, secret, new Date("2026-07-02T00:30:01Z")),
    ).toBe(false);
  });

  it("rejects future-issued and structurally invalid identities", () => {
    const secret = "session-secret";
    const issuedAt = new Date("2026-07-02T00:00:00Z");
    const token = createAdminSessionToken(secret, identity, issuedAt);

    expect(
      verifyAdminSessionToken(token, secret, new Date("2026-07-01T23:59:59Z")),
    ).toBe(false);
    expect(() =>
      createAdminSessionToken(secret, { ...identity, familyId: " " }, issuedAt),
    ).toThrow(TypeError);
  });
});
