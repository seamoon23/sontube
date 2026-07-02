import { notFound } from "next/navigation";
import { VideoForm, type VideoFormInitial } from "@/components/admin/video-form";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

type EditVideoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditVideoPage({ params }: EditVideoPageProps) {
  await requireAdminSession();

  const { id } = await params;
  const [video, tags, existingVideos] = await Promise.all([
    prisma.video.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    }),
    prisma.tag.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.video.findMany({
      where: { id: { not: id } },
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
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
    safetyStatus: video.safetyStatus,
    isPublished: video.isPublished,
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
        mode="edit"
        initial={initial}
        tags={tags.map(serializeTag)}
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
