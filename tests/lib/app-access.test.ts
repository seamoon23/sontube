import { describe, expect, it } from "vitest";
import {
  APP_ACCESS_TRIAL_DAYS,
  buildAppAccessTrialWindow,
  createRawAppAccessKey,
  getAppAccessState,
  hashAppAccessKey,
  makeAppKeyPrefix,
  verifyAppAccessKeyHash,
} from "@/lib/app-access";

describe("app access keys", () => {
  it("creates a high-entropy app key with a safe display prefix", () => {
    const key = createRawAppAccessKey();

    expect(key).toMatch(/^st_app_[a-zA-Z0-9_-]{32,}$/);
    expect(makeAppKeyPrefix(key)).toBe(key.slice(0, 14));
  });

  it("stores and verifies only a hash of the raw key", () => {
    const key = "st_app_test_key_123456789012345678901234";
    const hash = hashAppAccessKey(key);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(key);
    expect(verifyAppAccessKeyHash(key, hash)).toBe(true);
    expect(verifyAppAccessKeyHash("st_app_wrong_key_12345678901234567890", hash)).toBe(false);
  });

  it("starts a 14 day free trial at key creation time", () => {
    const start = new Date("2026-07-24T00:00:00.000Z");
    const window = buildAppAccessTrialWindow(start);

    expect(APP_ACCESS_TRIAL_DAYS).toBe(14);
    expect(window.trialStartedAt).toEqual(start);
    expect(window.trialEndsAt).toEqual(new Date("2026-08-07T00:00:00.000Z"));
  });

  it("computes disabled, trial, paid, and expired states", () => {
    const now = new Date("2026-07-24T00:00:00.000Z");

    expect(
      getAppAccessState(
        {
          isActive: false,
          trialEndsAt: new Date("2026-08-01T00:00:00.000Z"),
          paidUntil: new Date("2026-08-24T00:00:00.000Z"),
        },
        now,
      ),
    ).toMatchObject({ status: "disabled", canSync: false });

    expect(
      getAppAccessState(
        {
          isActive: true,
          trialEndsAt: new Date("2026-08-01T00:00:00.000Z"),
          paidUntil: null,
        },
        now,
      ),
    ).toMatchObject({ status: "trial", canSync: true });

    expect(
      getAppAccessState(
        {
          isActive: true,
          trialEndsAt: new Date("2026-07-01T00:00:00.000Z"),
          paidUntil: new Date("2026-08-24T00:00:00.000Z"),
        },
        now,
      ),
    ).toMatchObject({ status: "paid", canSync: true });

    expect(
      getAppAccessState(
        {
          isActive: true,
          trialEndsAt: new Date("2026-07-01T00:00:00.000Z"),
          paidUntil: null,
        },
        now,
      ),
    ).toMatchObject({ status: "expired", canSync: false });
  });
});