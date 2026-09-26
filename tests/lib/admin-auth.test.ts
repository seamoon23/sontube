import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ADMIN_IMPERSONATION_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  createImpersonatedAdminSessionToken,
  hashAdminPassword,
  getAdminAllowedEmails,
  isAdminEmailAllowed,
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
  sessionVersion: 1,
};

function createSignedTestToken(secret: string, payload: Record<string, unknown>): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("hex");
  return `${encodedPayload}.${signature}`;
}

describe("admin auth helpers", () => {
  it("detects whether parent session signing is configured", () => {
    expect(isAdminAuthConfigured({})).toBe(false);
    expect(isAdminAuthConfigured({ SESSION_SECRET: "secret" })).toBe(false);
    expect(
      isAdminAuthConfigured({
        SESSION_SECRET: "secret",
        ADMIN_ALLOWED_EMAILS: "parent@example.com,partner@example.com",
      }),
    ).toBe(true);
    expect(
      isAdminAuthConfigured({
        SESSION_SECRET: "secret",
        ADMIN_ALLOWED_EMAILS: "parent@example.com",
      }),
    ).toBe(false);
  });

  it("normalizes and enforces the bounded parent email allowlist", () => {
    const env = {
      ADMIN_ALLOWED_EMAILS: " Parent@Example.com,partner@example.com,parent@example.com ",
    };

    expect(getAdminAllowedEmails(env)).toEqual([
      "parent@example.com",
      "partner@example.com",
    ]);
    expect(isAdminEmailAllowed("PARENT@example.com", env)).toBe(true);
    expect(isAdminEmailAllowed("visitor@example.com", env)).toBe(false);
    expect(getAdminAllowedEmails({ ADMIN_ALLOWED_EMAILS: "not-an-email" })).toEqual([]);
    expect(getAdminAllowedEmails({ ADMIN_ALLOWED_EMAILS: "parent@example.com" })).toEqual([]);
    expect(
      getAdminAllowedEmails({
        ADMIN_ALLOWED_EMAILS: "one@example.com,two@example.com,three@example.com",
      }),
    ).toEqual([]);
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
    expect(() =>
      createAdminSessionToken(secret, { ...identity, sessionVersion: 0 }, issuedAt),
    ).toThrow(TypeError);
    expect(
      parseAdminSessionToken(
        createSignedTestToken(secret, {
          userId: identity.userId,
          familyId: identity.familyId,
          email: identity.email,
          displayName: identity.displayName,
          issuedAt: issuedAt.getTime(),
        }),
        secret,
        issuedAt,
      ),
    ).toBeNull();
  });
});
