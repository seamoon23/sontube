import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "sontube_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const ADMIN_SESSION_MAX_AGE_MS = ADMIN_SESSION_MAX_AGE_SECONDS * 1000;

type AdminAuthEnv = Record<string, string | undefined>;

export function isAdminAuthConfigured(env: AdminAuthEnv): boolean {
  return Boolean(env.ADMIN_PASSWORD_HASH?.trim() && env.SESSION_SECRET?.trim());
}

export function hashAdminPassword(password: string, secret: string): string {
  return scryptSync(password, secret, 32).toString("hex");
}

export function verifyAdminPassword(password: string, expectedHash: string, secret: string): boolean {
  const actualHash = hashAdminPassword(password, secret);
  return safeEqualHex(actualHash, expectedHash);
}

export function createAdminSessionToken(secret: string, issuedAt = new Date()): string {
  const payload = Buffer.from(JSON.stringify({ iat: issuedAt.getTime() })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAdminSessionToken(token: string | undefined, secret: string, now = new Date()): boolean {
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !/^[a-f0-9]{64}$/i.test(signature) || !safeEqualHex(sign(payload, secret), signature)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { iat?: unknown };
    if (typeof parsed.iat !== "number") return false;

    const ageMs = now.getTime() - parsed.iat;
    return ageMs >= 0 && ageMs <= ADMIN_SESSION_MAX_AGE_MS;
  } catch {
    return false;
  }
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
