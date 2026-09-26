"use server";

import { Prisma } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ADMIN_IMPERSONATION_SESSION_MAX_AGE_SECONDS,
  ADMIN_SESSION_COOKIE,
  createImpersonatedAdminSessionToken,
  hashAdminPassword,
  parseAdminSessionToken,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  PaymentServiceError,
  completePaymentRefund,
  confirmPaymentRequest,
  expirePaymentRequest,
  rejectPaymentRefund,
  rejectPaymentRequest,
  updatePaymentAdminMemo,
} from "@/lib/payment-service";
import {
  SUPERADMIN_SESSION_COOKIE,
  SUPERADMIN_SESSION_MAX_AGE_SECONDS,
  createSuperAdminSessionToken,
  isSuperAdminAuthConfigured,
  verifySuperAdminCredentials,
} from "@/lib/superadmin-auth";
import { requireSuperAdminSession } from "@/lib/superadmin-session";
import {
  createHashedRateLimitIdentifier,
  getMvpTrustedProxyClientIp,
  ProcessLocalFixedWindowRateLimiter,
} from "@/lib/rate-limit";

export type SuperAdminLoginResult = {
  ok: boolean;
  message: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PLAN_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,39}$/u;
const LOGIN_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const superAdminLoginRateLimiter = new ProcessLocalFixedWindowRateLimiter({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  maxRequests: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  maxBuckets: 5_000,
});
const STARTER_TAGS = [
  { name: "동물", slug: "animals", color: "#4d7c0f", icon: "paw", sortOrder: 10 },
  { name: "아기", slug: "baby", color: "#db2777", icon: "smile", sortOrder: 20 },
  { name: "음식", slug: "food", color: "#c2410c", icon: "utensils", sortOrder: 30 },
  { name: "여행", slug: "travel", color: "#0369a1", icon: "map", sortOrder: 40 },
  { name: "풍경", slug: "scenery", color: "#0f766e", icon: "mountain", sortOrder: 50 },
  { name: "자기계발", slug: "self", color: "#7c3aed", icon: "spark", sortOrder: 60 },
  { name: "학습", slug: "learning", color: "#2563eb", icon: "book", sortOrder: 70 },
  { name: "만들기", slug: "making", color: "#ca8a04", icon: "brush", sortOrder: 80 },
  { name: "운동", slug: "exercise", color: "#16a34a", icon: "move", sortOrder: 90 },
  { name: "과학", slug: "science", color: "#0891b2", icon: "flask", sortOrder: 100 },
  { name: "영어", slug: "english", color: "#4338ca", icon: "abc", sortOrder: 110 },
] as const;

export async function loginSuperAdminAction(formData: FormData): Promise<SuperAdminLoginResult> {
  if (!isSuperAdminAuthConfigured(process.env)) {
    return {
      ok: false,
      message: "최종관리자 로그인 환경변수가 설정되어 있지 않습니다.",
    };
  }

  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!loginId || loginId.length > 191 || !password || password.length > 256) {
    return { ok: false, message: "로그인 ID와 비밀번호를 확인해 주세요." };
  }

  const requestHeaders = await headers();
  const rateLimitKey = createHashedRateLimitIdentifier([
    getMvpTrustedProxyClientIp(requestHeaders),
    loginId.toLowerCase(),
  ]);
  if (!superAdminLoginRateLimiter.allow(rateLimitKey)) {
    return { ok: false, message: "로그인 시도가 너무 많습니다. 5분 뒤 다시 시도해 주세요." };
  }

  if (!verifySuperAdminCredentials(loginId, password, process.env)) {
    return { ok: false, message: "로그인 ID 또는 비밀번호가 올바르지 않습니다." };
  }

  superAdminLoginRateLimiter.delete(rateLimitKey);

  const cookieStore = await cookies();
  cookieStore.set(
    SUPERADMIN_SESSION_COOKIE,
    createSuperAdminSessionToken(process.env.SUPERADMIN_SESSION_SECRET ?? "", loginId),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SUPERADMIN_SESSION_MAX_AGE_SECONDS,
      path: "/",
    },
  );

  redirect("/superadmin");
}

export async function logoutSuperAdminAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SUPERADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  redirect("/superadmin/login");
}

export async function endImpersonationAction(): Promise<void> {
  const superAdminSession = await requireSuperAdminSession();
  const cookieStore = await cookies();
  const parentToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const parentSession = parseAdminSessionToken(parentToken, process.env.SESSION_SECRET ?? "");

  if (!parentSession?.impersonatedBy || parentSession.impersonatedBy !== superAdminSession.loginId) {
    redirect("/superadmin/users?error=" + encodeURIComponent("유효한 대체 로그인 세션을 찾을 수 없습니다."));
  }

  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });

  try {
    await prisma.superAdminAuditLog.create({
      data: {
        action: "IMPERSONATION_ENDED",
        actorId: superAdminSession.loginId,
        targetFamilyId: parentSession.familyId,
        targetUserId: parentSession.userId,
      },
    });
  } catch {
    // 세션 종료는 감사 저장소 장애와 무관하게 완료되어야 합니다.
  }
  redirect("/superadmin/users?notice=" + encodeURIComponent("대체 로그인을 종료했습니다."));
}
export async function createFamilyAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/users");
  let familyName = "";

  try {
    familyName = readRequiredText(formData, "familyName", "가족 이름", 80);
    const displayName = readRequiredText(formData, "displayName", "보호자 이름", 80);
    const email = readEmail(formData);
    const password = readPassword(formData);
    const sessionSecret = requireParentSessionSecret();

    await prisma.$transaction(async (tx) => {
      const family = await tx.family.create({ data: { name: familyName } });
      const user = await tx.parentUser.create({
        data: {
          familyId: family.id,
          email,
          displayName,
          passwordHash: hashAdminPassword(password, sessionSecret),
        },
      });
      await tx.tag.createMany({
        data: STARTER_TAGS.map((tag) => ({ ...tag, familyId: family.id })),
      });
      await tx.superAdminAuditLog.create({
        data: {
          action: "FAMILY_CREATED",
          actorId: session.loginId,
          targetFamilyId: family.id,
          targetUserId: user.id,
        },
      });
    });
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "가족과 보호자 계정을 만들지 못했습니다."));
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/users");
  redirectWithFlash(returnPath, "notice", `${familyName} 가족을 만들었습니다.`);
}

export async function createParentUserAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/users");
  let displayName = "";

  try {
    const familyId = readIdentifier(formData, "familyId", "가족");
    displayName = readRequiredText(formData, "displayName", "보호자 이름", 80);
    const email = readEmail(formData);
    const password = readPassword(formData);
    const sessionSecret = requireParentSessionSecret();

    await prisma.$transaction(async (tx) => {
      const family = await tx.family.findUnique({ where: { id: familyId }, select: { id: true } });
      if (!family) throw new ActionValidationError("가족을 찾을 수 없습니다.");

      const user = await tx.parentUser.create({
        data: {
          familyId,
          email,
          displayName,
          passwordHash: hashAdminPassword(password, sessionSecret),
        },
      });
      await tx.superAdminAuditLog.create({
        data: {
          action: "PARENT_USER_CREATED",
          actorId: session.loginId,
          targetFamilyId: familyId,
          targetUserId: user.id,
        },
      });
    });
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "보호자 계정을 추가하지 못했습니다."));
  }

  revalidatePath("/superadmin/users");
  redirectWithFlash(returnPath, "notice", `${displayName} 보호자 계정을 추가했습니다.`);
}

export async function toggleFamilyActiveAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/users");
  let nextActive = false;

  try {
    const familyId = readIdentifier(formData, "familyId", "가족");
    await prisma.$transaction(async (tx) => {
      const family = await tx.family.findUnique({ where: { id: familyId } });
      if (!family) throw new ActionValidationError("가족을 찾을 수 없습니다.");
      nextActive = !family.isActive;
      await tx.family.update({ where: { id: familyId }, data: { isActive: nextActive } });
      await tx.parentUser.updateMany({
        where: { familyId },
        data: { sessionVersion: { increment: 1 } },
      });
      await tx.superAdminAuditLog.create({
        data: {
          action: nextActive ? "FAMILY_ACTIVATED" : "FAMILY_DEACTIVATED",
          actorId: session.loginId,
          targetFamilyId: familyId,
        },
      });
    });
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "가족 상태를 바꾸지 못했습니다."));
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/users");
  redirectWithFlash(returnPath, "notice", nextActive ? "가족을 활성화했습니다." : "가족을 비활성화했습니다.");
}

export async function toggleParentUserActiveAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/users");
  let nextActive = false;

  try {
    const userId = readIdentifier(formData, "userId", "보호자");
    await prisma.$transaction(async (tx) => {
      const user = await tx.parentUser.findUnique({ where: { id: userId } });
      if (!user) throw new ActionValidationError("보호자 계정을 찾을 수 없습니다.");
      nextActive = !user.isActive;
      await tx.parentUser.update({
        where: { id: userId },
        data: {
          isActive: nextActive,
          sessionVersion: { increment: 1 },
        },
      });
      await tx.superAdminAuditLog.create({
        data: {
          action: nextActive ? "PARENT_USER_ACTIVATED" : "PARENT_USER_DEACTIVATED",
          actorId: session.loginId,
          targetFamilyId: user.familyId,
          targetUserId: user.id,
        },
      });
    });
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "보호자 상태를 바꾸지 못했습니다."));
  }

  revalidatePath("/superadmin/users");
  redirectWithFlash(returnPath, "notice", nextActive ? "보호자 계정을 활성화했습니다." : "보호자 계정을 비활성화했습니다.");
}

export async function resetParentPasswordAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/users");

  try {
    const userId = readIdentifier(formData, "userId", "보호자");
    const password = readPassword(formData);
    const sessionSecret = requireParentSessionSecret();

    await prisma.$transaction(async (tx) => {
      const user = await tx.parentUser.findUnique({ where: { id: userId } });
      if (!user) throw new ActionValidationError("보호자 계정을 찾을 수 없습니다.");
      await tx.parentUser.update({
        where: { id: userId },
        data: {
          passwordHash: hashAdminPassword(password, sessionSecret),
          sessionVersion: { increment: 1 },
        },
      });
      await tx.superAdminAuditLog.create({
        data: {
          action: "PARENT_PASSWORD_RESET",
          actorId: session.loginId,
          targetFamilyId: user.familyId,
          targetUserId: user.id,
        },
      });
    });
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "비밀번호를 재설정하지 못했습니다."));
  }

  revalidatePath("/superadmin/users");
  redirectWithFlash(returnPath, "notice", "보호자 비밀번호를 재설정했습니다.");
}

export async function startImpersonationAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/users");

  try {
    const userId = readIdentifier(formData, "userId", "보호자");
    const reason = readRequiredText(formData, "reason", "대체 로그인 사유", 500, 5);
    const password = String(formData.get("superadminPassword") ?? "");
    if (!password || password.length > 256) {
      throw new ActionValidationError("최종관리자 비밀번호를 입력해 주세요.");
    }
    if (!verifySuperAdminCredentials(session.loginId, password, process.env)) {
      throw new ActionValidationError("최종관리자 비밀번호가 올바르지 않습니다.");
    }

    const sessionSecret = requireParentSessionSecret();
    const user = await prisma.parentUser.findFirst({
      where: {
        id: userId,
        isActive: true,
        family: { isActive: true },
      },
      select: {
        id: true,
        familyId: true,
        email: true,
        displayName: true,
        sessionVersion: true,
      },
    });
    if (!user) {
      throw new ActionValidationError("활성 상태의 보호자 계정을 찾을 수 없습니다.");
    }

    const issuedAt = new Date();
    await prisma.superAdminAuditLog.create({
      data: {
        action: "IMPERSONATION_STARTED",
        actorId: session.loginId,
        targetFamilyId: user.familyId,
        targetUserId: user.id,
        metadataJson: JSON.stringify({
          reason,
          expiresAt: new Date(issuedAt.getTime() + ADMIN_IMPERSONATION_SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
        }),
      },
    });

    const token = createImpersonatedAdminSessionToken(
      sessionSecret,
      {
        userId: user.id,
        familyId: user.familyId,
        email: user.email,
        displayName: user.displayName,
        sessionVersion: user.sessionVersion,
      },
      session.loginId,
      issuedAt,
    );
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ADMIN_IMPERSONATION_SESSION_MAX_AGE_SECONDS,
      path: "/",
    });
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "대체 로그인을 시작하지 못했습니다."));
  }

  redirect("/admin");
}

export async function createPaymentPlanAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/plans");
  let planName = "";

  try {
    const code = readPlanCode(formData);
    planName = readRequiredText(formData, "name", "요금제 이름", 80);
    const description = readOptionalText(formData, "description", 500);
    const priceKrw = readInteger(formData, "priceKrw", "가격", 1, 100_000_000);
    const durationDays = readInteger(formData, "durationDays", "이용기간", 1, 3650);
    const displayOrder = readInteger(formData, "displayOrder", "표시 순서", -10000, 10000);
    const isActive = formData.get("isActive") === "on";

    await prisma.$transaction(async (tx) => {
      const plan = await tx.paymentPlan.create({
        data: { code, name: planName, description, priceKrw, durationDays, displayOrder, isActive },
      });
      await tx.superAdminAuditLog.create({
        data: {
          action: "PAYMENT_PLAN_CREATED",
          actorId: session.loginId,
          metadataJson: JSON.stringify({ planId: plan.id, code, priceKrw, durationDays }),
        },
      });
    });
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "요금제를 만들지 못했습니다."));
  }

  revalidatePath("/superadmin/plans");
  redirectWithFlash(returnPath, "notice", `${planName} 요금제를 만들었습니다.`);
}

export async function updatePaymentPlanAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/plans");

  try {
    const planId = readIdentifier(formData, "planId", "요금제");
    const code = readPlanCode(formData);
    const name = readRequiredText(formData, "name", "요금제 이름", 80);
    const description = readOptionalText(formData, "description", 500);
    const priceKrw = readInteger(formData, "priceKrw", "가격", 1, 100_000_000);
    const durationDays = readInteger(formData, "durationDays", "이용기간", 1, 3650);
    const displayOrder = readInteger(formData, "displayOrder", "표시 순서", -10000, 10000);

    await prisma.$transaction(async (tx) => {
      const current = await tx.paymentPlan.findUnique({ where: { id: planId } });
      if (!current) throw new ActionValidationError("요금제를 찾을 수 없습니다.");
      await tx.paymentPlan.update({
        where: { id: planId },
        data: { code, name, description, priceKrw, durationDays, displayOrder },
      });
      await tx.superAdminAuditLog.create({
        data: {
          action: "PAYMENT_PLAN_UPDATED",
          actorId: session.loginId,
          metadataJson: JSON.stringify({ planId, code, priceKrw, durationDays }),
        },
      });
    });
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "요금제를 수정하지 못했습니다."));
  }

  revalidatePath("/superadmin/plans");
  redirectWithFlash(returnPath, "notice", "요금제를 수정했습니다.");
}

export async function togglePaymentPlanActiveAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/plans");
  let nextActive = false;

  try {
    const planId = readIdentifier(formData, "planId", "요금제");
    await prisma.$transaction(async (tx) => {
      const plan = await tx.paymentPlan.findUnique({ where: { id: planId } });
      if (!plan) throw new ActionValidationError("요금제를 찾을 수 없습니다.");
      nextActive = !plan.isActive;
      if (nextActive && (plan.priceKrw < 1 || plan.durationDays < 1)) {
        throw new ActionValidationError(
          "가격과 이용 기간을 먼저 1 이상으로 저장한 뒤 활성화해 주세요.",
        );
      }
      await tx.paymentPlan.update({ where: { id: planId }, data: { isActive: nextActive } });
      await tx.superAdminAuditLog.create({
        data: {
          action: nextActive ? "PAYMENT_PLAN_ACTIVATED" : "PAYMENT_PLAN_DEACTIVATED",
          actorId: session.loginId,
          metadataJson: JSON.stringify({ planId, code: plan.code }),
        },
      });
    });
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "요금제 상태를 바꾸지 못했습니다."));
  }

  revalidatePath("/superadmin/plans");
  redirectWithFlash(returnPath, "notice", nextActive ? "요금제를 활성화했습니다." : "요금제를 비활성화했습니다.");
}

export async function confirmPaymentAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/payments");

  try {
    await confirmPaymentRequest({
      paymentRequestId: readIdentifier(formData, "paymentRequestId", "결제 신청"),
      actorId: session.loginId,
      receivedAmountKrw: formData.get("receivedAmountKrw"),
      receivedDate: formData.get("receivedDate"),
      adminMemo: formData.get("adminMemo"),
    });
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "입금 승인을 처리하지 못했습니다."));
  }

  revalidatePaymentPaths();
  redirectWithFlash(returnPath, "notice", "입금을 확인하고 가족 이용기간을 반영했습니다.");
}

export async function resolvePendingPaymentAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/payments");
  const resolution = String(formData.get("resolution") ?? "");

  try {
    const input = {
      paymentRequestId: readIdentifier(formData, "paymentRequestId", "결제 신청"),
      actorId: session.loginId,
      adminMemo: formData.get("adminMemo"),
    };
    if (resolution === "REJECTED") {
      await rejectPaymentRequest(input);
    } else if (resolution === "EXPIRED") {
      await expirePaymentRequest(input);
    } else {
      throw new ActionValidationError("처리 유형을 확인해 주세요.");
    }
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "입금 신청 상태를 바꾸지 못했습니다."));
  }

  revalidatePaymentPaths();
  redirectWithFlash(returnPath, "notice", resolution === "EXPIRED" ? "입금 신청을 만료 처리했습니다." : "입금 신청을 확인 불가 처리했습니다.");
}

export async function updatePaymentMemoAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/payments");

  try {
    await updatePaymentAdminMemo({
      paymentRequestId: readIdentifier(formData, "paymentRequestId", "결제 신청"),
      actorId: session.loginId,
      adminMemo: formData.get("adminMemo"),
    });
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "관리자 메모를 저장하지 못했습니다."));
  }

  revalidatePaymentPaths();
  redirectWithFlash(returnPath, "notice", "관리자 메모를 저장했습니다.");
}

export async function resolveRefundAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdminSession();
  const returnPath = getReturnPath(formData, "/superadmin/payments");
  const resolution = String(formData.get("resolution") ?? "");

  try {
    const input = {
      paymentRequestId: readIdentifier(formData, "paymentRequestId", "결제 신청"),
      actorId: session.loginId,
      adminMemo: formData.get("adminMemo"),
    };
    if (resolution === "COMPLETED") {
      await completePaymentRefund(input);
    } else if (resolution === "REJECTED") {
      await rejectPaymentRefund(input);
    } else {
      throw new ActionValidationError("환불 처리 유형을 확인해 주세요.");
    }
  } catch (error) {
    redirectWithFlash(returnPath, "error", getActionErrorMessage(error, "환불을 처리하지 못했습니다."));
  }

  revalidatePaymentPaths();
  redirectWithFlash(returnPath, "notice", resolution === "COMPLETED" ? "환불 완료와 이용권 회수를 반영했습니다." : "환불 요청을 반려했습니다.");
}

class ActionValidationError extends Error {}

function readIdentifier(formData: FormData, field: string, label: string): string {
  return validateText(String(formData.get(field) ?? ""), label, 200, 1);
}

function readRequiredText(
  formData: FormData,
  field: string,
  label: string,
  maxLength: number,
  minLength = 1,
): string {
  return validateText(String(formData.get(field) ?? ""), label, maxLength, minLength);
}

function readOptionalText(formData: FormData, field: string, maxLength: number): string | null {
  const normalized = String(formData.get(field) ?? "").normalize("NFKC").trim();
  if (!normalized) return null;
  if (Array.from(normalized).length > maxLength) {
    throw new ActionValidationError(`설명은 ${maxLength}자 이하로 입력해 주세요.`);
  }
  return normalized;
}

function validateText(value: string, label: string, maxLength: number, minLength: number): string {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const length = Array.from(normalized).length;
  if (length < minLength || length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new ActionValidationError(`${label}은 ${minLength}-${maxLength}자로 입력해 주세요.`);
  }
  return normalized;
}

function readEmail(formData: FormData): string {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
    throw new ActionValidationError("올바른 이메일 주소를 입력해 주세요.");
  }
  return email;
}

function readPassword(formData: FormData): string {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");
  if (password.length < 10 || password.length > 128) {
    throw new ActionValidationError("비밀번호는 10-128자로 입력해 주세요.");
  }
  if (password !== confirmation) {
    throw new ActionValidationError("비밀번호 확인이 일치하지 않습니다.");
  }
  return password;
}

function readPlanCode(formData: FormData): string {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!PLAN_CODE_PATTERN.test(code)) {
    throw new ActionValidationError("요금제 코드는 영문 대문자, 숫자, 밑줄, 하이픈 2-40자로 입력해 주세요.");
  }
  return code;
}

function readInteger(
  formData: FormData,
  field: string,
  label: string,
  minimum: number,
  maximum: number,
): number {
  const raw = String(formData.get(field) ?? "").trim();
  if (!/^-?\d+$/u.test(raw)) {
    throw new ActionValidationError(`${label}은 정수로 입력해 주세요.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ActionValidationError(`${label}은 ${minimum}-${maximum} 범위로 입력해 주세요.`);
  }
  return value;
}

function requireParentSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  if (!secret) {
    throw new ActionValidationError("보호자 SESSION_SECRET 환경변수가 필요합니다.");
  }
  return secret;
}

function getReturnPath(formData: FormData, fallback: string): string {
  const raw = String(formData.get("returnTo") ?? "").trim();
  if (!raw) return fallback;

  try {
    const url = new URL(raw, "https://sontube.local");
    const isSuperadminPath =
      url.pathname === "/superadmin" || url.pathname.startsWith("/superadmin/");
    if (url.origin !== "https://sontube.local" || !isSuperadminPath) {
      return fallback;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

function redirectWithFlash(path: string, type: "notice" | "error", message: string): never {
  const url = new URL(path, "https://sontube.local");
  url.searchParams.delete("notice");
  url.searchParams.delete("error");
  url.searchParams.set(type, message);
  redirect(`${url.pathname}${url.search}`);
}

function getActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ActionValidationError || error instanceof PaymentServiceError) {
    return error.message;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "이미 등록된 값이 있습니다. 이메일이나 요금제 코드를 확인해 주세요.";
  }
  console.error("Superadmin action failed without exposing submitted values.");
  return fallback;
}

function revalidatePaymentPaths(): void {
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/payments");
  revalidatePath("/superadmin/audit");
  revalidatePath("/admin/payment");
}
