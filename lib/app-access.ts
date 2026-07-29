import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const APP_ACCESS_TRIAL_DAYS = 14;
export const APP_ACCESS_SYNC_INTERVAL_HOURS = 24;

export type AppAccessStatus = "disabled" | "trial" | "paid" | "expired";

export type AppAccessRecord = {
  isActive: boolean;
  trialEndsAt: Date;
  paidUntil: Date | null;
};

export type AppAccessState = {
  status: AppAccessStatus;
  canSync: boolean;
  label: string;
  trialEndsAt: string;
  paidUntil: string | null;
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

export function buildAppAccessTrialWindow(start = new Date()): {
  trialStartedAt: Date;
  trialEndsAt: Date;
} {
  return {
    trialStartedAt: start,
    trialEndsAt: addDays(start, APP_ACCESS_TRIAL_DAYS),
  };
}

export function getAppAccessState(record: AppAccessRecord, now = new Date()): AppAccessState {
  if (!record.isActive) {
    return buildState("disabled", false, record);
  }

  if (record.paidUntil && record.paidUntil.getTime() > now.getTime()) {
    return buildState("paid", true, record);
  }

  if (record.trialEndsAt.getTime() > now.getTime()) {
    return buildState("trial", true, record);
  }

  return buildState("expired", false, record);
}

export function getNextRecommendedSyncAt(lastSyncedAt: Date | null, now = new Date()): string {
  const base = lastSyncedAt ?? now;
  return new Date(base.getTime() + APP_ACCESS_SYNC_INTERVAL_HOURS * 60 * 60 * 1000).toISOString();
}

function buildState(status: AppAccessStatus, canSync: boolean, record: AppAccessRecord): AppAccessState {
  return {
    status,
    canSync,
    label: getStatusLabel(status),
    trialEndsAt: record.trialEndsAt.toISOString(),
    paidUntil: record.paidUntil?.toISOString() ?? null,
  };
}

function getStatusLabel(status: AppAccessStatus): string {
  switch (status) {
    case "disabled":
      return "비활성";
    case "trial":
      return "무료 체험";
    case "paid":
      return "이용 가능";
    case "expired":
      return "체험 종료";
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}