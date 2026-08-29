import { describe, expect, it } from "vitest";
import { hashAdminPassword } from "@/lib/admin-auth";
import {
  SUPERADMIN_SESSION_MAX_AGE_SECONDS,
  createSuperAdminSessionToken,
  isSuperAdminAuthConfigured,
  parseSuperAdminSessionToken,
  verifySuperAdminCredentials,
  verifySuperAdminSessionToken,
} from "@/lib/superadmin-auth";

describe("superadmin auth helpers", () => {
  const secret = "separate-superadmin-secret";
  const env = {
    SUPERADMIN_LOGIN_ID: "owner",
    SUPERADMIN_PASSWORD_HASH: hashAdminPassword("owner-pass", secret),
    SUPERADMIN_SESSION_SECRET: secret,
  };

  it("requires a login ID, password hash, and independent session secret", () => {
    expect(isSuperAdminAuthConfigured({})).toBe(false);
    expect(
      isSuperAdminAuthConfigured({
        SUPERADMIN_LOGIN_ID: "owner",
        SUPERADMIN_PASSWORD_HASH: env.SUPERADMIN_PASSWORD_HASH,
      }),
    ).toBe(false);
    expect(isSuperAdminAuthConfigured(env)).toBe(true);
  });

  it("verifies both the configured login ID and password", () => {
    expect(verifySuperAdminCredentials("owner", "owner-pass", env)).toBe(true);
    expect(verifySuperAdminCredentials("other", "owner-pass", env)).toBe(false);
    expect(verifySuperAdminCredentials("owner", "wrong-pass", env)).toBe(false);
  });

  it("creates a separate four-hour signed session", () => {
    const issuedAt = new Date("2026-07-02T00:00:00Z");
    const token = createSuperAdminSessionToken(secret, "owner", issuedAt);

    expect(SUPERADMIN_SESSION_MAX_AGE_SECONDS).toBe(4 * 60 * 60);
    expect(
      parseSuperAdminSessionToken(
        token,
        secret,
        "owner",
        new Date("2026-07-02T03:59:59Z"),
      ),
    ).toEqual({
      loginId: "owner",
      issuedAt: issuedAt.getTime(),
    });
    expect(
      verifySuperAdminSessionToken(
        token,
        secret,
        "other",
        new Date("2026-07-02T03:00:00Z"),
      ),
    ).toBe(false);
    expect(
      verifySuperAdminSessionToken(
        token,
        secret,
        "owner",
        new Date("2026-07-02T04:00:01Z"),
      ),
    ).toBe(false);
    expect(
      verifySuperAdminSessionToken(
        `${token}x`,
        secret,
        "owner",
        new Date("2026-07-02T01:00:00Z"),
      ),
    ).toBe(false);
  });
});
