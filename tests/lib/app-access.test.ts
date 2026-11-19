import { describe, expect, it } from "vitest";
import {
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

  it("ignores historical trial and payment dates while preserving disabled keys", () => {
    const expiredRecord = {
      isActive: true,
      trialEndsAt: new Date("2020-01-01"),
      paidUntil: null,
    };
    expect(getAppAccessState(expiredRecord)).toEqual({ status: "free", canSync: true, label: "무료 이용" });
    expect(getAppAccessState({ ...expiredRecord, isActive: false })).toMatchObject({ status: "disabled", canSync: false });
  });
});
