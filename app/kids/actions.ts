"use server";

import { KidsSignalType as PrismaKidsSignalType, SafetyStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isKidsSignalType } from "@/lib/kids-signals";
import { getAppAccessState, hashAppAccessKey, normalizeAppAccessKey } from "@/lib/app-access";
import { requireAdminSession } from "@/lib/admin-session";
import { isAdminMutationBlocked } from "@/lib/admin-mutation-guard";

export type KidsSignalActionInput = {
  videoId: string;
  clientKey: string;
  type: string;
  active?: boolean;
  appKey?: string;
  installationId?: string;
};

export async function recordKidsSignalAction(input: KidsSignalActionInput) {
  const videoId = String(input.videoId ?? "").trim();
  const clientKey = String(input.clientKey ?? "").trim();
  const rawType = String(input.type ?? "");

  if (!videoId || !clientKey || clientKey.length > 120 || !isKidsSignalType(rawType)) {
    return { ok: false, message: "반응을 저장하지 못했습니다." };
  }

  const familyId = await resolveSignalFamilyId(input);
  if (!familyId) {
    return { ok: false, message: "앱 등록 상태를 확인해 주세요." };
  }

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      familyId,
      isPublished: true,
      safetyStatus: SafetyStatus.PARENT_CHECKED,
    },
    select: { id: true },
  });

  if (!video) {
    return { ok: false, message: "볼 수 있는 영상을 찾지 못했습니다." };
  }

  const type = rawType as PrismaKidsSignalType;

  if (input.active === false) {
    await prisma.kidsVideoSignal.deleteMany({
      where: { videoId, clientKey, type },
    });
  } else {
    await prisma.kidsVideoSignal.upsert({
      where: {
        videoId_clientKey_type: {
          videoId,
          clientKey,
          type,
        },
      },
      create: {
        videoId,
        clientKey,
        type,
      },
      update: {
        updatedAt: new Date(),
      },
    });
  }

  revalidatePath("/admin/insights");
  return { ok: true, message: "저장했습니다." };
}

async function resolveSignalFamilyId(input: KidsSignalActionInput): Promise<string | null> {
  const appKey = normalizeAppAccessKey(String(input.appKey ?? ""));
  const installationId = String(input.installationId ?? "").trim();

  if (appKey && installationId) {
    const accessKey = await prisma.appAccessKey.findUnique({
      where: { keyHash: hashAppAccessKey(appKey) },
      include: { family: { select: { isActive: true } } },
    });
    if (
      accessKey?.familyId &&
      accessKey.family?.isActive &&
      accessKey.installationId === installationId &&
      getAppAccessState(accessKey).canSync
    ) {
      return accessKey.familyId;
    }
    return null;
  }

  const session = await requireAdminSession();
  if (isAdminMutationBlocked(session)) return null;
  return session.familyId;
}
