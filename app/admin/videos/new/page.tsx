import { VideoForm } from "@/components/admin/video-form";
import { prisma } from "@/lib/db";

export default async function NewVideoPage() {
  const [tags, existingVideos] = await Promise.all([
    prisma.tag.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.video.findMany({
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold text-ocean">영상 등록</p>
        <h2 className="text-2xl font-bold text-ink">새 영상</h2>
      </div>
      <VideoForm
        mode="create"
        tags={tags.map(serializeTag)}
        existingVideos={existingVideos.map((video) => ({
          id: video.id,
          title: video.title,
          description: video.description,
          tags: video.tags.map(({ tag }) => serializeTag(tag)),
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
