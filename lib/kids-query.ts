import { Prisma, SafetyStatus } from "@prisma/client";

export type KidsVideoFilter = {
  q?: string;
  tagSlug?: string;
  parentRecommendedOnly?: boolean;
};

export function buildKidsVideoWhere(filter: KidsVideoFilter): Prisma.VideoWhereInput {
  const q = filter.q?.trim();
  const tagSlug = filter.tagSlug?.trim();

  return {
    isPublished: true,
    safetyStatus: SafetyStatus.PARENT_CHECKED,
    ...(q ? { OR: [{ title: { contains: q } }, { searchKeywords: { contains: q } }] } : {}),
    ...(filter.parentRecommendedOnly ? { isParentRecommended: true } : {}),
    ...(tagSlug
      ? {
          tags: {
            some: {
              tag: {
                slug: tagSlug,
                isActive: true,
              },
            },
          },
        }
      : {}),
  };
}
