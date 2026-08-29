import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "sontube_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const ADMIN_IMPERSONATION_SESSION_MAX_AGE_SECONDS = 60 * 30;

const ADMIN_SESSION_MAX_AGE_MS = ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
const ADMIN_IMPERSONATION_SESSION_MAX_AGE_MS =
  ADMIN_IMPERSONATION_SESSION_MAX_AGE_SECONDS * 1000;
const MAX_SESSION_TOKEN_LENGTH = 4096;

type AdminAuthEnv = Record<string, string | undefined>;

export type AdminSessionIdentity = {
  userId: string;
  familyId: string;
  email: string;
  displayName: string;
  impersonatedBy?: string;
};

export type AdminSessionPayload = AdminSessionIdentity & {
  issuedAt: number;
};

export function isAdminAuthConfigured(env: AdminAuthEnv): boolean {
  return Boolean(env.SESSION_SECRET?.trim());
}

export function hashAdminPassword(password: string, secret: string): string {
  return scryptSync(password, secret, 32).toString("hex");
}

export function verifyAdminPassword(password: string, expectedHash: string, secret: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) {
    return false;
  }

  const actualHash = hashAdminPassword(password, secret);
  return safeEqualHex(actualHash, expectedHash);
}

export function createAdminSessionToken(
  secret: string,
  identity: AdminSessionIdentity,
  issuedAt = new Date(),
): string {
  const payload: AdminSessionPayload = {
    userId: identity.userId,
    familyId: identity.familyId,
    email: identity.email,
    displayName: identity.displayName,
    ...(identity.impersonatedBy ? { impersonatedBy: identity.impersonatedBy } : {}),
    issuedAt: issuedAt.getTime(),
  };

  if (!isAdminSessionPayload(payload)) {
    throw new TypeError("관리자 세션 정보를 확인해 주세요.");
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function createImpersonatedAdminSessionToken(
  secret: string,
  identity: Omit<AdminSessionIdentity, "impersonatedBy">,
  impersonatedBy: string,
  issuedAt = new Date(),
): string {
  return createAdminSessionToken(secret, { ...identity, impersonatedBy }, issuedAt);
}

export function parseAdminSessionToken(
  token: string | undefined,
  secret: string,
  now = new Date(),
): AdminSessionPayload | null {
  if (!token || token.length > MAX_SESSION_TOKEN_LENGTH) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;
  if (
    !encodedPayload ||
    !signature ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    !safeEqualHex(sign(encodedPayload, secret), signature)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as unknown;

    if (!isAdminSessionPayload(parsed)) {
      return null;
    }

    const ageMs = now.getTime() - parsed.issuedAt;
    const maxAgeMs = parsed.impersonatedBy
      ? ADMIN_IMPERSONATION_SESSION_MAX_AGE_MS
      : ADMIN_SESSION_MAX_AGE_MS;

    return ageMs >= 0 && ageMs <= maxAgeMs ? parsed : null;
  } catch {
    return null;
  }
}

export function verifyAdminSessionToken(
  token: string | undefined,
  secret: string,
  now = new Date(),
): boolean {
  return parseAdminSessionToken(token, secret, now) !== null;
}

function isAdminSessionPayload(value: unknown): value is AdminSessionPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isBoundedText(value.userId, 1, 191) &&
    isBoundedText(value.familyId, 1, 191) &&
    isBoundedText(value.email, 3, 320) &&
    isBoundedText(value.displayName, 1, 120) &&
    (value.impersonatedBy === undefined ||
      isBoundedText(value.impersonatedBy, 1, 191)) &&
    typeof value.issuedAt === "number" &&
    Number.isSafeInteger(value.issuedAt) &&
    value.issuedAt >= 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedText(value: unknown, min: number, max: number): value is string {
  return (
    typeof value === "string" &&
    value.length >= min &&
    value.length <= max &&
    value.trim() === value
  );
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
