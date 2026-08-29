import { Prisma, SafetyStatus, ThumbnailType } from "@prisma/client";

export const UNASSIGNED_CHANNEL_FILTER = "__unassigned";

export type AdminVideoFilterInput = {
  q?: string;
  tagId?: string;
  channelId?: string;
  status?: string;
  recommended?: string;
  thumbnail?: string;
};

export function buildAdminVideoWhere(input: AdminVideoFilterInput): Prisma.VideoWhereInput {
  const q = input.q?.trim() ?? "";
  const where: Prisma.VideoWhereInput = {};

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
      { searchKeywords: { contains: q } },
      { youtubeVideoId: { contains: q } },
      { channel: { displayName: { contains: q } } },
    ];
  }

  if (input.tagId) {
    where.tags = { some: { tagId: input.tagId } };
  }

  if (input.channelId === UNASSIGNED_CHANNEL_FILTER) {
    where.channelId = null;
  } else if (input.channelId) {
    where.channelId = input.channelId;
  }

  if (input.status === "published") {
    where.isPublished = true;
    where.safetyStatus = SafetyStatus.PARENT_CHECKED;
  } else if (input.status === "review") {
    where.safetyStatus = SafetyStatus.NEEDS_REVIEW;
  } else if (input.status === "hidden") {
    where.safetyStatus = SafetyStatus.HIDDEN;
  }

  if (input.recommended === "1") {
    where.isParentRecommended = true;
  }

  if (isThumbnailType(input.thumbnail)) {
    where.thumbnailType = input.thumbnail;
  }

  return where;
}

function isThumbnailType(value: string | undefined): value is ThumbnailType {
  return value === ThumbnailType.YOUTUBE || value === ThumbnailType.CUSTOM || value === ThumbnailType.PLACEHOLDER;
}
