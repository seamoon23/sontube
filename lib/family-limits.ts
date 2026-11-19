import type { Prisma } from "@prisma/client";

export const DEFAULT_FAMILY_VIDEO_LIMIT = 20;
export const MAX_FAMILY_VIDEO_LIMIT = 100_000;

export async function getFamilyVideoUsage(db: Pick<Prisma.TransactionClient, "family" | "video">, familyId: string) {
  const family = await db.family.findUniqueOrThrow({
    where: { id: familyId },
    select: { videoLimit: true },
  });
  const count = await db.video.count({ where: { familyId } });
  return { count, limit: family.videoLimit, canCreate: count < family.videoLimit };
}

export function videoLimitMessage(limit: number): string {
  return `가족 영상 등록 한도 ${limit}개에 도달했습니다. 기존 영상은 계속 관리하고 시청할 수 있습니다.`;
}
