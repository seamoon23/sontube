import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const APP_ACCESS_SYNC_INTERVAL_MINUTES = 5;

export type AppAccessStatus = "disabled" | "free";

export type AppAccessRecord = {
  isActive: boolean;
};

export type AppAccessState = {
  status: AppAccessStatus;
  canSync: boolean;
  label: string;
};

export function createRawAppAccessKey(): string {
  return `st_app_${randomBytes(32).toString("base64url")}`;
}

export function hashAppAccessKey(rawKey: string): string {
  return createHash("sha256").update(normalizeAppAccessKey(rawKey)).digest("hex");
}

export function verifyAppAccessKeyHash(rawKey: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashAppAccessKey(rawKey), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function makeAppKeyPrefix(rawKey: string): string {
  return normalizeAppAccessKey(rawKey).slice(0, 14);
}

export function normalizeAppAccessKey(rawKey: string): string {
  return rawKey.trim();
}

export function getAppAccessState(record: AppAccessRecord): AppAccessState {
  return {
    status: record.isActive ? "free" : "disabled",
    canSync: record.isActive,
    label: record.isActive ? "무료 이용" : "비활성",
  };
}

export function getNextRecommendedSyncAt(lastSyncedAt: Date | null, now = new Date()): string {
  const base = lastSyncedAt ?? now;
  return new Date(base.getTime() + APP_ACCESS_SYNC_INTERVAL_MINUTES * 60 * 1000).toISOString();
}
