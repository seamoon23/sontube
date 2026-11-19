import { VideoForm } from "@/components/admin/video-form";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-session";
import { canPublishLite } from "@/lib/admin-auth";
import { getFamilyVideoUsage, videoLimitMessage } from "@/lib/family-limits";

export const dynamic = "force-dynamic";

export default async function NewVideoPage() {
  const session = await requireAdminSession();
  const usage = await getFamilyVideoUsage(prisma, session.familyId);
  if (!usage.canCreate) {
    return <section className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5"><h2 className="text-xl font-bold">영상 등록 한도</h2><p>{videoLimitMessage(usage.limit)}</p><a href="/admin/videos" className="min-h-11 py-3 font-semibold underline">기존 영상 관리로 이동</a></section>;
  }

  const [tags, existingVideos, channels] = await Promise.all([
    prisma.tag.findMany({
      where: { familyId: session.familyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.video.findMany({
      where: { familyId: session.familyId },
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.channel.findMany({
      where: { familyId: session.familyId, isActive: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, isActive: true },
    }),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold text-ocean">영상 등록</p>
        <h2 className="text-2xl font-bold text-ink">새 영상</h2>
      </div>
      <VideoForm
        canPublishLite={canPublishLite(session, process.env)}
        mode="create"
        tags={tags.map(serializeTag)}
        channels={channels}
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
