"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-session";
import {
  cleanChannelDisplayName,
  MAX_CHANNEL_DISPLAY_NAME_LENGTH,
  normalizeChannelName,
} from "@/lib/channels";
import { prisma } from "@/lib/db";

export type ChannelActionResult = {
  ok: boolean;
  message: string;
};

export async function renameChannelAction(
  channelId: string,
  formData: FormData,
): Promise<ChannelActionResult> {
  const session = await requireAdminSession();
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, familyId: session.familyId },
    select: { id: true },
  });
  if (!channel) {
    return { ok: false, message: "수정할 채널을 찾을 수 없습니다." };
  }

  const displayName = cleanChannelDisplayName(String(formData.get("displayName") ?? ""));
  if (!displayName) {
    return { ok: false, message: "채널명을 입력해 주세요." };
  }
  if (displayName.length > MAX_CHANNEL_DISPLAY_NAME_LENGTH) {
    return {
      ok: false,
      message: `채널명은 ${MAX_CHANNEL_DISPLAY_NAME_LENGTH}자 이하로 입력해 주세요.`,
    };
  }

  const normalizedName = normalizeChannelName(displayName);
  const duplicate = await prisma.channel.findFirst({
    where: {
      familyId: session.familyId,
      normalizedName,
      id: { not: channel.id },
    },
    select: { displayName: true },
  });
  if (duplicate) {
    return {
      ok: false,
      message: `이미 "${duplicate.displayName}" 채널이 있습니다. 중복 채널 병합을 사용해 주세요.`,
    };
  }

  await prisma.channel.update({
    where: { id: channel.id },
    data: { displayName, normalizedName },
  });
  revalidateChannelPaths();
  return { ok: true, message: "채널명을 변경했습니다." };
}

export async function toggleChannelActiveAction(
  channelId: string,
): Promise<ChannelActionResult> {
  const session = await requireAdminSession();
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, familyId: session.familyId },
    select: { id: true, isActive: true },
  });
  if (!channel) {
    return { ok: false, message: "변경할 채널을 찾을 수 없습니다." };
  }

  const isActive = !channel.isActive;
  await prisma.channel.update({
    where: { id: channel.id },
    data: { isActive },
  });
  revalidateChannelPaths();
  return {
    ok: true,
    message: isActive
      ? "채널을 다시 사용할 수 있게 했습니다."
      : "새 영상의 채널 선택 목록에서 숨겼습니다. 기존 영상 연결은 유지됩니다.",
  };
}

export async function mergeChannelAction(
  sourceChannelId: string,
  formData: FormData,
): Promise<ChannelActionResult> {
  const session = await requireAdminSession();
  const targetChannelId = String(formData.get("targetChannelId") ?? "").trim();
  if (!targetChannelId) {
    return { ok: false, message: "합칠 대상 채널을 선택해 주세요." };
  }
  if (sourceChannelId === targetChannelId) {
    return { ok: false, message: "같은 채널끼리는 합칠 수 없습니다." };
  }

  const channels = await prisma.channel.findMany({
    where: {
      familyId: session.familyId,
      id: { in: [sourceChannelId, targetChannelId] },
    },
    select: { id: true, displayName: true, isActive: true },
  });
  const source = channels.find((channel) => channel.id === sourceChannelId);
  const target = channels.find((channel) => channel.id === targetChannelId);
  if (!source || !target) {
    return { ok: false, message: "같은 가족의 채널인지 다시 확인해 주세요." };
  }
  if (!target.isActive) {
    return { ok: false, message: "사용 중인 채널만 병합 대상으로 선택할 수 있습니다." };
  }

  const movedVideoCount = await prisma.video.count({
    where: { familyId: session.familyId, channelId: source.id },
  });
  await prisma.$transaction([
    prisma.video.updateMany({
      where: { familyId: session.familyId, channelId: source.id },
      data: { channelId: target.id },
    }),
    prisma.channel.delete({ where: { id: source.id } }),
  ]);

  revalidateChannelPaths();
  return {
    ok: true,
    message: `"${source.displayName}"의 영상 ${movedVideoCount}편을 "${target.displayName}"으로 합쳤습니다.`,
  };
}

function revalidateChannelPaths() {
  revalidatePath("/admin/channels");
  revalidatePath("/admin/videos");
  revalidatePath("/admin/videos/new");
  revalidatePath("/app");
}