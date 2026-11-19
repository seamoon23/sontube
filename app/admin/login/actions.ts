"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  isAdminAuthConfigured,
  parseAdminSessionToken,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  createHashedRateLimitIdentifier,
  getMvpTrustedProxyClientIp,
  ProcessLocalFixedWindowRateLimiter,
} from "@/lib/rate-limit";

export type LoginResult = {
  ok: boolean;
  message: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PASSWORD_HASH_PATTERN = /^[a-f0-9]{64}$/iu;
const DUMMY_PASSWORD_HASH = "0".repeat(64);
const parentLoginRateLimiter = new ProcessLocalFixedWindowRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 5,
  maxBuckets: 5_000,
});

export async function loginAdminAction(formData: FormData): Promise<LoginResult> {
  if (!isAdminAuthConfigured(process.env)) {
    return {
      ok: false,
      message: "보호자 로그인 환경설정을 확인해 주세요.",
    };
  }

  const email = String(formData.get("email") ?? "").normalize("NFKC").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (
    !email ||
    email.length > 320 ||
    !EMAIL_PATTERN.test(email) ||
    !password ||
    password.length > 256
  ) {
    return { ok: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  const requestHeaders = await headers();
  const rateLimitKey = createHashedRateLimitIdentifier([
    getMvpTrustedProxyClientIp(requestHeaders),
    email,
  ]);
  if (!parentLoginRateLimiter.allow(rateLimitKey)) {
    return { ok: false, message: "로그인 시도가 너무 많습니다. 5분 뒤 다시 시도해 주세요." };
  }

  const user = await prisma.parentUser.findUnique({
    where: { email },
    include: { family: { select: { isActive: true } } },
  });
  const expectedPasswordHash =
    user && PASSWORD_HASH_PATTERN.test(user.passwordHash)
      ? user.passwordHash
      : DUMMY_PASSWORD_HASH;
  const passwordMatches = verifyAdminPassword(
    password,
    expectedPasswordHash,
    process.env.SESSION_SECRET ?? "",
  );
  const isValid = Boolean(
    user?.isActive && user.family.isActive && passwordMatches,
  );

  if (!isValid || !user) {
    return {
      ok: false,
      message: "이메일 또는 비밀번호가 올바르지 않습니다.",
    };
  }

  parentLoginRateLimiter.delete(rateLimitKey);

  await prisma.parentUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const cookieStore = await cookies();
  const previousSession = parseAdminSessionToken(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET ?? "",
  );
  cookieStore.set(
    ADMIN_SESSION_COOKIE,
    createAdminSessionToken(process.env.SESSION_SECRET ?? "", {
      userId: user.id,
      familyId: user.familyId,
      email: user.email,
      displayName: user.displayName,
      sessionVersion: user.sessionVersion,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      path: "/",
    },
  );

  if (previousSession?.impersonatedBy) {
    try {
      await prisma.superAdminAuditLog.create({
        data: {
          action: "IMPERSONATION_ENDED",
          actorId: previousSession.impersonatedBy,
          targetFamilyId: previousSession.familyId,
          targetUserId: previousSession.userId,
          metadataJson: JSON.stringify({ endedFrom: "parent_login" }),
        },
      });
    } catch {
      // 정상 로그인은 감사 저장소 장애와 무관하게 완료되어야 합니다.
    }
  }

  redirect("/admin");
}

export async function logoutAdminAction(): Promise<void> {
  const cookieStore = await cookies();
  const session = parseAdminSessionToken(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET ?? "",
  );

  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });

  if (session?.impersonatedBy) {
    try {
      await prisma.superAdminAuditLog.create({
        data: {
          action: "IMPERSONATION_ENDED",
          actorId: session.impersonatedBy,
          targetFamilyId: session.familyId,
          targetUserId: session.userId,
          metadataJson: JSON.stringify({ endedFrom: "parent_logout" }),
        },
      });
    } catch {
      // 로그아웃은 감사 저장소 장애와 무관하게 완료되어야 합니다.
    }
  }

  if (session?.impersonatedBy) {
    redirect("/superadmin/users?notice=" + encodeURIComponent("대체 로그인을 종료했습니다."));
  }
  redirect("/admin/login");
}
