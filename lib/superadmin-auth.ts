import { createHmac, timingSafeEqual } from "node:crypto";
import { verifyAdminPassword } from "@/lib/admin-auth";

export const SUPERADMIN_SESSION_COOKIE = "sontube_superadmin_session";
export const SUPERADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 4;

const SUPERADMIN_SESSION_MAX_AGE_MS = SUPERADMIN_SESSION_MAX_AGE_SECONDS * 1000;
const MAX_SESSION_TOKEN_LENGTH = 2048;

type SuperAdminAuthEnv = Record<string, string | undefined>;

export type SuperAdminSessionPayload = {
  loginId: string;
  issuedAt: number;
};

export function isSuperAdminAuthConfigured(env: SuperAdminAuthEnv): boolean {
  return Boolean(
    env.SUPERADMIN_LOGIN_ID?.trim() &&
      env.SUPERADMIN_PASSWORD_HASH?.trim() &&
      env.SUPERADMIN_SESSION_SECRET?.trim(),
  );
}

export function verifySuperAdminCredentials(
  loginId: string,
  password: string,
  env: SuperAdminAuthEnv,
): boolean {
  const expectedLoginId = env.SUPERADMIN_LOGIN_ID?.trim() ?? "";
  const passwordHash = env.SUPERADMIN_PASSWORD_HASH?.trim() ?? "";
  const secret = env.SUPERADMIN_SESSION_SECRET ?? "";
  const loginIdMatches = safeEqualText(loginId.trim(), expectedLoginId);
  const passwordMatches = verifyAdminPassword(password, passwordHash, secret);

  return isSuperAdminAuthConfigured(env) && loginIdMatches && passwordMatches;
}

export function createSuperAdminSessionToken(
  secret: string,
  loginId: string,
  issuedAt = new Date(),
): string {
  const payload: SuperAdminSessionPayload = {
    loginId: loginId.trim(),
    issuedAt: issuedAt.getTime(),
  };

  if (!isSuperAdminSessionPayload(payload)) {
    throw new TypeError("최종관리자 세션 정보를 확인해 주세요.");
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function parseSuperAdminSessionToken(
  token: string | undefined,
  secret: string,
  expectedLoginId?: string,
  now = new Date(),
): SuperAdminSessionPayload | null {
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

    if (!isSuperAdminSessionPayload(parsed)) {
      return null;
    }

    if (
      expectedLoginId !== undefined &&
      !safeEqualText(parsed.loginId, expectedLoginId.trim())
    ) {
      return null;
    }

    const ageMs = now.getTime() - parsed.issuedAt;
    return ageMs >= 0 && ageMs <= SUPERADMIN_SESSION_MAX_AGE_MS ? parsed : null;
  } catch {
    return null;
  }
}

export function verifySuperAdminSessionToken(
  token: string | undefined,
  secret: string,
  expectedLoginId?: string,
  now = new Date(),
): boolean {
  return parseSuperAdminSessionToken(token, secret, expectedLoginId, now) !== null;
}

function isSuperAdminSessionPayload(value: unknown): value is SuperAdminSessionPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.loginId === "string" &&
    record.loginId.length >= 1 &&
    record.loginId.length <= 191 &&
    record.loginId.trim() === record.loginId &&
    typeof record.issuedAt === "number" &&
    Number.isSafeInteger(record.issuedAt) &&
    record.issuedAt >= 0
  );
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
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
