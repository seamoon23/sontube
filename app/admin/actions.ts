"use server";

import { PlayMode, Prisma, SafetyStatus, ThumbnailType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  cleanChannelDisplayName,
  MAX_CHANNEL_DISPLAY_NAME_LENGTH,
  normalizeChannelName,
} from "@/lib/channels";
import { resolveManagedCustomThumbnailPath, validateCustomThumbnailFile } from "@/lib/custom-thumbnail";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-session";
import {
  IMPERSONATION_READ_ONLY_MESSAGE,
  isAdminMutationBlocked,
} from "@/lib/admin-mutation-guard";
import { splitTagNames, slugifyTagName } from "@/lib/tags";
import { buildYouTubeThumbnailUrl, parseYouTubeVideoId } from "@/lib/youtube";
import { tagFormSchema, videoClientSchema } from "@/lib/validation";

export type ActionResult = {
  ok: boolean;
  message: string;
};

const THUMBNAIL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "thumbnails");
export async function createVideoAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (isAdminMutationBlocked(session)) {
    return { ok: false, message: IMPERSONATION_READ_ONLY_MESSAGE };
  }

  const input = readVideoFormData(formData);
  const parsed = videoClientSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  const videoIdResult = parseYouTubeVideoId(parsed.data.originalUrl);
  if (!videoIdResult.ok) {
    return { ok: false, message: videoIdResult.message };
  }

  const duplicate = await prisma.video.findUnique({
    where: {
      familyId_youtubeVideoId: {
        familyId: session.familyId,
        youtubeVideoId: videoIdResult.videoId,
      },
    },
    select: { id: true, title: true },
  });

  if (duplicate) {
    return {
      ok: false,
      message: `이미 등록된 영상입니다: ${duplicate.title}`,
    };
  }

  const tagIds = await resolveTagIds(session.familyId, parsed.data.tagIds ?? [], parsed.data.quickNewTags ?? "");
  const thumbnail = await resolveThumbnail(formData, videoIdResult.videoId, parsed.data.thumbnailType);
  if (!thumbnail.ok) {
    return { ok: false, message: thumbnail.message };
  }
  const channel = await resolveChannelId(
    session.familyId,
    parsed.data.channelMode,
    parsed.data.channelId,
    parsed.data.newChannelName,
  );
  if (!channel.ok) {
    return { ok: false, message: channel.message };
  }

  await prisma.$transaction(async (tx) => {
    await tx.video.create({
      data: {
        familyId: session.familyId,
        youtubeVideoId: videoIdResult.videoId,
        originalUrl: parsed.data.originalUrl,
        title: parsed.data.title,
        channelId: channel.channelId,
        description: emptyToNull(parsed.data.description),
        searchKeywords: emptyToNull(parsed.data.searchKeywords),
        durationText: emptyToNull(parsed.data.durationText),
        thumbnailType: thumbnail.value.thumbnailType,
        youtubeThumbnailUrl: thumbnail.value.youtubeThumbnailUrl,
        customThumbnailPath: thumbnail.value.customThumbnailPath,
        safetyStatus: parsed.data.safetyStatus as SafetyStatus,
        isPublished: parsed.data.isPublished,
        isLitePublished: parsed.data.isLitePublished,
        liteSortOrder: parsed.data.liteSortOrder,
        isParentRecommended: parsed.data.isParentRecommended,
        parentRecommendedAt: parsed.data.isParentRecommended ? new Date() : null,
        playMode: parsed.data.playMode as PlayMode,
        tags: {
          create: tagIds.map((tagId) => ({
            tag: { connect: { id: tagId } },
          })),
        },
      },
    });

    await refreshTagStats(tx, tagIds);
  });

  revalidateVideoPaths();
  redirect("/admin/videos");
}

export async function updateVideoAction(videoId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (isAdminMutationBlocked(session)) {
    return { ok: false, message: IMPERSONATION_READ_ONLY_MESSAGE };
  }

  const existing = await prisma.video.findFirst({
    where: { id: videoId, familyId: session.familyId },
    include: { tags: true },
  });

  if (!existing) {
    return { ok: false, message: "수정할 영상을 찾을 수 없습니다." };
  }

  const input = readVideoFormData(formData);
  const parsed = videoClientSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  const videoIdResult = parseYouTubeVideoId(parsed.data.originalUrl);
  if (!videoIdResult.ok) {
    return { ok: false, message: videoIdResult.message };
  }

  const duplicate = await prisma.video.findFirst({
    where: {
      familyId: session.familyId,
      youtubeVideoId: videoIdResult.videoId,
      id: { not: videoId },
    },
    select: { title: true },
  });

  if (duplicate) {
    return {
      ok: false,
      message: `다른 영상으로 이미 등록되어 있습니다: ${duplicate.title}`,
    };
  }

  const previousTagIds = existing.tags.map((tag) => tag.tagId);
  const tagIds = await resolveTagIds(session.familyId, parsed.data.tagIds ?? [], parsed.data.quickNewTags ?? "");
  const previousCustomThumbnailPath = existing.customThumbnailPath;
  const thumbnail = await resolveThumbnail(
    formData,
    videoIdResult.videoId,
    parsed.data.thumbnailType,
    existing.customThumbnailPath,
  );
  if (!thumbnail.ok) {
    return { ok: false, message: thumbnail.message };
  }
  const channel = await resolveChannelId(
    session.familyId,
    parsed.data.channelMode,
    parsed.data.channelId,
    parsed.data.newChannelName,
  );
  if (!channel.ok) {
    return { ok: false, message: channel.message };
  }

  await prisma.$transaction(async (tx) => {
    await tx.video.update({
      where: { id: videoId },
      data: {
        familyId: session.familyId,
        youtubeVideoId: videoIdResult.videoId,
        originalUrl: parsed.data.originalUrl,
        title: parsed.data.title,
        channelId: channel.channelId,
        description: emptyToNull(parsed.data.description),
        searchKeywords: emptyToNull(parsed.data.searchKeywords),
        durationText: emptyToNull(parsed.data.durationText),
        thumbnailType: thumbnail.value.thumbnailType,
        youtubeThumbnailUrl: thumbnail.value.youtubeThumbnailUrl,
        customThumbnailPath: thumbnail.value.customThumbnailPath,
        safetyStatus: parsed.data.safetyStatus as SafetyStatus,
        isPublished: parsed.data.isPublished,
        isLitePublished: parsed.data.isLitePublished,
        liteSortOrder: parsed.data.liteSortOrder,
        isParentRecommended: parsed.data.isParentRecommended,
        parentRecommendedAt:
          parsed.data.isParentRecommended && !existing.isParentRecommended ? new Date() : existing.parentRecommendedAt,
        playMode: parsed.data.playMode as PlayMode,
        tags: {
          deleteMany: {},
          create: tagIds.map((tagId) => ({
            tag: { connect: { id: tagId } },
          })),
        },
      },
    });

    await refreshTagStats(tx, [...previousTagIds, ...tagIds]);
  });

  if (previousCustomThumbnailPath && previousCustomThumbnailPath !== thumbnail.value.customThumbnailPath) {
    await deleteManagedCustomThumbnailIfUnused(previousCustomThumbnailPath);
  }

  revalidateVideoPaths();
  redirect("/admin/videos");
}

export async function createTagAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (isAdminMutationBlocked(session)) {
    return { ok: false, message: IMPERSONATION_READ_ONLY_MESSAGE };
  }

  const parsed = tagFormSchema.safeParse(readTagFormData(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "태그 입력값을 확인해 주세요." };
  }

  const slug = slugifyTagName(parsed.data.name);
  if (!slug) {
    return { ok: false, message: "태그 이름으로 slug를 만들 수 없습니다." };
  }

  const duplicate = await prisma.tag.findUnique({
    where: { familyId_slug: { familyId: session.familyId, slug } },
  });
  if (duplicate) {
    return { ok: false, message: "이미 같은 이름의 태그가 있습니다." };
  }

  await prisma.tag.create({
    data: {
      ...parsed.data,
      familyId: session.familyId,
      slug,
      description: emptyToNull(parsed.data.description),
      icon: emptyToNull(parsed.data.icon),
    },
  });

  revalidateTagPaths();
  return { ok: true, message: "태그를 추가했습니다." };
}

export async function updateTagAction(tagId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (isAdminMutationBlocked(session)) {
    return { ok: false, message: IMPERSONATION_READ_ONLY_MESSAGE };
  }

  const target = await prisma.tag.findFirst({
    where: { id: tagId, familyId: session.familyId },
    select: { id: true },
  });
  if (!target) {
    return { ok: false, message: "수정할 태그를 찾을 수 없습니다." };
  }

  const parsed = tagFormSchema.safeParse(readTagFormData(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "태그 입력값을 확인해 주세요." };
  }

  const slug = slugifyTagName(parsed.data.name);
  const duplicate = await prisma.tag.findFirst({
    where: {
      familyId: session.familyId,
      slug,
      id: { not: tagId },
    },
  });

  if (duplicate) {
    return { ok: false, message: "이미 같은 이름의 태그가 있습니다." };
  }

  await prisma.tag.update({
    where: { id: tagId },
    data: {
      ...parsed.data,
      familyId: session.familyId,
      slug,
      description: emptyToNull(parsed.data.description),
      icon: emptyToNull(parsed.data.icon),
    },
  });

  revalidateTagPaths();
  return { ok: true, message: "태그를 수정했습니다." };
}

function readVideoFormData(formData: FormData) {
  return {
    originalUrl: String(formData.get("originalUrl") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    searchKeywords: String(formData.get("searchKeywords") ?? ""),
    durationText: String(formData.get("durationText") ?? ""),
    channelMode: String(formData.get("channelMode") ?? "NONE"),
    channelId: String(formData.get("channelId") ?? ""),
    newChannelName: String(formData.get("newChannelName") ?? ""),
    safetyStatus: String(formData.get("safetyStatus") ?? "NEEDS_REVIEW"),
    isPublished: formData.get("isPublished") === "on",
    isLitePublished: formData.get("isLitePublished") === "on",
    liteSortOrder: String(formData.get("liteSortOrder") ?? "0"),
    isParentRecommended: formData.get("isParentRecommended") === "on",
    playMode: String(formData.get("playMode") ?? "SINGLE_THEN_CLOSE"),
    thumbnailType: String(formData.get("thumbnailType") ?? "YOUTUBE"),
    quickNewTags: String(formData.get("quickNewTags") ?? ""),
    tagIds: formData.getAll("tagIds").map(String),
  };
}

function readTagFormData(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    color: String(formData.get("color") ?? "#0369a1"),
    icon: String(formData.get("icon") ?? ""),
    description: String(formData.get("description") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
    isActive: formData.get("isActive") === "on",
  };
}

async function resolveTagIds(
  familyId: string,
  selectedTagIds: string[],
  quickNewTags: string | string[],
): Promise<string[]> {
  const selectedTags = await prisma.tag.findMany({
    where: { id: { in: selectedTagIds }, familyId },
    select: { id: true },
  });
  const names = Array.isArray(quickNewTags) ? quickNewTags : splitTagNames(quickNewTags);
  const createdIds: string[] = [];

  for (const name of names) {
    const slug = slugifyTagName(name);
    if (!slug) continue;

    const tag = await prisma.tag.upsert({
      where: { familyId_slug: { familyId, slug } },
      create: {
        familyId,
        name,
        slug,
        color: "#0369a1",
        isActive: true,
      },
      update: {
        isActive: true,
      },
      select: { id: true },
    });
    createdIds.push(tag.id);
  }

  return Array.from(new Set([...selectedTags.map((tag) => tag.id), ...createdIds]));
}
async function resolveChannelId(
  familyId: string,
  mode: "NONE" | "EXISTING" | "NEW",
  selectedChannelId?: string,
  newChannelName?: string,
): Promise<{ ok: true; channelId: string | null } | { ok: false; message: string }> {
  if (mode === "NONE") {
    return { ok: true, channelId: null };
  }

  if (mode === "EXISTING") {
    const channelId = selectedChannelId?.trim() ?? "";
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, familyId },
      select: { id: true },
    });

    if (!channel) {
      return { ok: false, message: "선택한 채널을 찾을 수 없습니다. 채널을 다시 선택해 주세요." };
    }

    return { ok: true, channelId: channel.id };
  }

  const displayName = cleanChannelDisplayName(newChannelName ?? "");
  if (!displayName) {
    return { ok: false, message: "새 채널명을 입력해 주세요." };
  }
  if (displayName.length > MAX_CHANNEL_DISPLAY_NAME_LENGTH) {
    return {
      ok: false,
      message: `채널명은 ${MAX_CHANNEL_DISPLAY_NAME_LENGTH}자 이하로 입력해 주세요.`,
    };
  }

  const normalizedName = normalizeChannelName(displayName);
  if (!normalizedName) {
    return { ok: false, message: "사용할 수 있는 채널명을 입력해 주세요." };
  }

  const channel = await prisma.channel.upsert({
    where: { familyId_normalizedName: { familyId, normalizedName } },
    create: {
      familyId,
      displayName,
      normalizedName,
      isActive: true,
    },
    update: { isActive: true },
    select: { id: true },
  });

  return { ok: true, channelId: channel.id };
}

async function resolveThumbnail(
  formData: FormData,
  youtubeVideoId: string,
  requestedType: "YOUTUBE" | "CUSTOM" | "PLACEHOLDER",
  existingCustomThumbnailPath?: string | null,
) {
  if (requestedType === "PLACEHOLDER") {
    return {
      ok: true as const,
      value: {
        thumbnailType: ThumbnailType.PLACEHOLDER,
        youtubeThumbnailUrl: null,
        customThumbnailPath: null,
      },
    };
  }

  if (requestedType === "CUSTOM") {
    const uploadResult = await saveCustomThumbnail(formData, youtubeVideoId);
    if (uploadResult.ok) {
      return {
        ok: true as const,
        value: {
          thumbnailType: ThumbnailType.CUSTOM,
          youtubeThumbnailUrl: null,
          customThumbnailPath: uploadResult.path,
        },
      };
    }

    if ("message" in uploadResult) {
      return uploadResult;
    }

    if (existingCustomThumbnailPath) {
      return {
        ok: true as const,
        value: {
          thumbnailType: ThumbnailType.CUSTOM,
          youtubeThumbnailUrl: null,
          customThumbnailPath: existingCustomThumbnailPath,
        },
      };
    }
  }

  return {
    ok: true as const,
    value: {
      thumbnailType: ThumbnailType.YOUTUBE,
      youtubeThumbnailUrl: buildYouTubeThumbnailUrl(youtubeVideoId),
      customThumbnailPath: null,
    },
  };
}

async function saveCustomThumbnail(formData: FormData, youtubeVideoId: string) {
  const file = formData.get("customThumbnail");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const };
  }

  const validation = validateCustomThumbnailFile(file);
  if (!validation.ok) {
    return validation;
  }

  await mkdir(THUMBNAIL_UPLOAD_DIR, { recursive: true });
  const fileName = `${youtubeVideoId}-${Date.now()}.${validation.extension}`;
  const filePath = path.join(THUMBNAIL_UPLOAD_DIR, fileName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, bytes);

  return {
    ok: true as const,
    path: `/uploads/thumbnails/${fileName}`,
  };
}

async function deleteManagedCustomThumbnailIfUnused(publicPath: string) {
  const remainingReferences = await prisma.video.count({
    where: { customThumbnailPath: publicPath },
  });
  if (remainingReferences > 0) return;

  const filePath = resolveManagedCustomThumbnailPath(publicPath);
  if (!filePath) return;

  try {
    await unlink(filePath);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return;
    }

    console.warn(`Failed to delete custom thumbnail: ${publicPath}`, error);
  }
}

async function refreshTagStats(tx: Prisma.TransactionClient, tagIds: string[]) {
  const uniqueTagIds = Array.from(new Set(tagIds)).filter(Boolean);
  if (uniqueTagIds.length === 0) return;

  const grouped = await tx.videoTag.groupBy({
    by: ["tagId"],
    where: { tagId: { in: uniqueTagIds } },
    _count: { tagId: true },
    _max: { assignedAt: true },
  });
  const groupedById = new Map(grouped.map((item) => [item.tagId, item]));

  for (const tagId of uniqueTagIds) {
    const item = groupedById.get(tagId);
    await tx.tag.update({
      where: { id: tagId },
      data: {
        usageCount: item?._count.tagId ?? 0,
        lastUsedAt: item?._max.assignedAt ?? null,
      },
    });
  }
}

function emptyToNull(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function revalidateVideoPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/videos");
  revalidatePath("/kids");
  revalidatePath("/lite");
  revalidatePath("/api/lite/catalog");
}

function revalidateTagPaths() {
  revalidatePath("/admin/tags");
  revalidatePath("/admin/videos/new");
  revalidatePath("/kids");
}
