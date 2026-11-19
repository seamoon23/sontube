import { notFound } from "next/navigation";
import { VideoForm, type VideoFormInitial } from "@/components/admin/video-form";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-session";
import { canPublishLite } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type EditVideoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditVideoPage({ params }: EditVideoPageProps) {
  const session = await requireAdminSession();

  const { id } = await params;
  const [video, tags, existingVideos, channels] = await Promise.all([
    prisma.video.findFirst({
      where: { id, familyId: session.familyId },
      include: { tags: { include: { tag: true } } },
    }),
    prisma.tag.findMany({
      where: { familyId: session.familyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.video.findMany({
      where: { familyId: session.familyId, id: { not: id } },
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.channel.findMany({
      where: { familyId: session.familyId },
      orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
      select: { id: true, displayName: true, isActive: true },
    }),
  ]);

  if (!video) notFound();

  const initial: VideoFormInitial = {
    id: video.id,
    originalUrl: video.originalUrl,
    title: video.title,
    description: video.description ?? "",
    searchKeywords: video.searchKeywords ?? "",
    durationText: video.durationText ?? "",
    channelId: video.channelId,
    safetyStatus: video.safetyStatus,
    isPublished: video.isPublished,
    isLitePublished: video.isLitePublished,
    liteSortOrder: video.liteSortOrder,
    isParentRecommended: video.isParentRecommended,
    playMode: video.playMode,
    thumbnailType: video.thumbnailType,
    tagIds: video.tags.map(({ tagId }) => tagId),
    customThumbnailPath: video.customThumbnailPath,
  };

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold text-ocean">영상 수정</p>
        <h2 className="text-2xl font-bold text-ink">{video.title}</h2>
      </div>
      <VideoForm
        canPublishLite={canPublishLite(session, process.env)}
        mode="edit"
        initial={initial}
        tags={tags.map(serializeTag)}
        channels={channels}
        existingVideos={existingVideos.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          tags: item.tags.map(({ tag }) => serializeTag(tag)),
        }))}
      />
    </div>
  );
}

function serializeTag(tag: {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  description: string | null;
  usageCount: number;
  lastUsedAt: Date | null;
  isActive: boolean;
}) {
  return {
    ...tag,
    lastUsedAt: tag.lastUsedAt?.toISOString() ?? null,
  };
}
