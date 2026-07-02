import { SafetyStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getThumbnailUrl } from "@/lib/thumbnails";
import { buildEmbedUrl } from "@/lib/youtube";
import { KidsFeedbackButtons } from "@/components/kids/kids-feedback-buttons";
import { KidsPlaylistButton } from "@/components/kids/kids-playlist-controls";

type WatchPageProps = {
  params: Promise<{ id: string }>;
};

export default async function KidsWatchPage({ params }: WatchPageProps) {
  const { id } = await params;
  const video = await prisma.video.findFirst({
    where: {
      id,
      isPublished: true,
      safetyStatus: SafetyStatus.PARENT_CHECKED,
    },
    include: {
      tags: {
        where: { tag: { isActive: true } },
        include: { tag: true },
      },
    },
  });

  if (!video) notFound();

  return (
    <main className="min-h-screen bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/kids"
            className="rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
          >
            돌아가기
          </Link>
          <div className="flex flex-wrap justify-end gap-2">
            {video.tags.slice(0, 4).map(({ tag }) => (
              <span key={tag.id} className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white">
                {tag.name}
              </span>
            ))}
          </div>
        </div>

        <section className="grid gap-4">
          <div className="aspect-video overflow-hidden rounded-lg bg-black shadow-soft">
            <iframe
              src={buildEmbedUrl(video.youtubeVideoId)}
              title={video.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <div className="grid gap-2">
            <h1 className="text-2xl font-black md:text-3xl">{video.title}</h1>
            {video.description && <p className="max-w-3xl text-sm leading-6 text-slate-200">{video.description}</p>}
            <div className="pt-2">
              <KidsPlaylistButton
                item={{
                  id: video.id,
                  title: video.title,
                  thumbnailUrl: getThumbnailUrl(video),
                  durationText: video.durationText,
                }}
              />
            </div>
            <KidsFeedbackButtons videoId={video.id} />
          </div>
        </section>
      </div>
    </main>
  );
}
