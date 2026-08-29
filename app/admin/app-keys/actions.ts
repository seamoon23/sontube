"use server";

import { revalidatePath } from "next/cache";
import {
  buildAppAccessTrialWindow,
  createRawAppAccessKey,
  hashAppAccessKey,
  makeAppKeyPrefix,
} from "@/lib/app-access";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";

export type AppKeyActionResult = {
  ok: boolean;
  message: string;
  createdKey?: string;
  keyPrefix?: string;
};

export async function createAppAccessKeyAction(formData: FormData): Promise<AppKeyActionResult> {
  const session = await requireAdminSession();

  const name = normalizeName(String(formData.get("name") ?? ""));
  if (name.length > 80) {
    return { ok: false, message: "앱 키 이름은 80자 이하로 입력해 주세요." };
  }

  const rawKey = createRawAppAccessKey();
  const trial = buildAppAccessTrialWindow();
  const subscription = await prisma.familySubscription.findUnique({
    where: { familyId: session.familyId },
    select: { status: true, expiresAt: true },
  });

  await prisma.appAccessKey.create({
    data: {
      familyId: session.familyId,
      name: name || defaultKeyName(),
      keyHash: hashAppAccessKey(rawKey),
      keyPrefix: makeAppKeyPrefix(rawKey),
      trialStartedAt: trial.trialStartedAt,
      trialEndsAt: trial.trialEndsAt,
      paidUntil:
        subscription?.status === "ACTIVE" && subscription.expiresAt > new Date()
          ? subscription.expiresAt
          : null,
    },
  });

  revalidatePath("/admin/app-keys");

  return {
    ok: true,
    message: "앱 키를 만들었습니다. 원문 키는 지금 한 번만 확인할 수 있습니다.",
    createdKey: rawKey,
    keyPrefix: makeAppKeyPrefix(rawKey),
  };
}

export async function disableAppAccessKeyAction(id: string): Promise<AppKeyActionResult> {
  const session = await requireAdminSession();

  const target = await prisma.appAccessKey.findFirst({
    where: { id, familyId: session.familyId },
    select: { id: true, isActive: true },
  });

  if (!target) {
    return { ok: false, message: "앱 키를 찾을 수 없습니다." };
  }

  if (!target.isActive) {
    return { ok: true, message: "이미 비활성화된 앱 키입니다." };
  }

  await prisma.appAccessKey.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath("/admin/app-keys");

  return { ok: true, message: "앱 키를 비활성화했습니다." };
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function defaultKeyName(): string {
  return `가족 앱 ${new Date().toISOString().slice(0, 10)}`;
}