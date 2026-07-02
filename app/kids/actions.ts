"use server";

import { KidsSignalType as PrismaKidsSignalType, SafetyStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isKidsSignalType } from "@/lib/kids-signals";

export type KidsSignalActionInput = {
  videoId: string;
  clientKey: string;
  type: string;
  active?: boolean;
};

export async function recordKidsSignalAction(input: KidsSignalActionInput) {
  const videoId = String(input.videoId ?? "").trim();
  const clientKey = String(input.clientKey ?? "").trim();
  const rawType = String(input.type ?? "");

  if (!videoId || !clientKey || clientKey.length > 120 || !isKidsSignalType(rawType)) {
    return { ok: false, message: "반응을 저장하지 못했습니다." };
  }

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
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
