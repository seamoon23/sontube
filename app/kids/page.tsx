import Link from "next/link";
import { KidsPlaylistPanel } from "@/components/kids/kids-playlist-controls";
import { KidsVideoCard } from "@/components/kids/video-card";
import { prisma } from "@/lib/db";
import { buildKidsVideoWhere } from "@/lib/kids-query";
import { SafetyStatus } from "@prisma/client";

type KidsPageProps = {
  searchParams: Promise<{
    q?: string;
    tag?: string;
  }>;
};

export default async function KidsPage({ searchParams }: KidsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const tagSlug = params.tag ?? "";
  const visibleVideoWhere = {
    isPublished: true,
    safetyStatus: SafetyStatus.PARENT_CHECKED,
  };
  const videoWhere = buildKidsVideoWhere({ q, tagSlug });

  const [videos, recommendedVideos, hotTags] = await Promise.all([
    prisma.video.findMany({
      where: videoWhere,
      include: {
        tags: {
          where: { tag: { isActive: true } },
          include: { tag: true },
          orderBy: { tag: { sortOrder: "asc" } },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.video.findMany({
      where: buildKidsVideoWhere({ parentRecommendedOnly: true }),
      include: {
        tags: {
          where: { tag: { isActive: true } },
          include: { tag: true },
          orderBy: { tag: { sortOrder: "asc" } },
        },
      },
      orderBy: [{ parentRecommendedAt: "desc" }, { updatedAt: "desc" }],
      take: 6,
    }),
    prisma.tag.findMany({
      where: {
        isActive: true,
        videos: {
          some: {
            video: visibleVideoWhere,
          },
        },
      },
      include: {
        videos: {
          where: { video: visibleVideoWhere },
          select: { videoId: true },
        },
      },
      orderBy: [{ usageCount: "desc" }, { lastUsedAt: "desc" }, { sortOrder: "asc" }],
      take: 12,
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-5 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-4">
          <div>
            <p className="text-sm font-semibold text-ocean">SonTube</p>
            <h1 className="text-3xl font-black text-ink md:text-4xl">영상서랍</h1>
          </div>
          <form className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label htmlFor="kids-search" className="sr-only">
              제목 또는 부모님 키워드 검색
            </label>
            <input
              id="kids-search"
              name="q"
              defaultValue={q}
              placeholder="제목 또는 부모님 키워드 검색"
              className="rounded-md border border-slate-300 px-4 py-3 text-base outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
            />
            {tagSlug && <input type="hidden" name="tag" value={tagSlug} />}
            <button type="submit" className="rounded-md bg-ink px-5 py-3 text-sm font-bold text-white">
              찾기
            </button>
          </form>
          {hotTags.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Link
                href={q ? `/kids?q=${encodeURIComponent(q)}` : "/kids"}
                aria-current={tagSlug ? undefined : "page"}
                className={`whitespace-nowrap rounded-md border px-3 py-2 text-sm font-bold ${
                  tagSlug ? "border-slate-300 bg-white text-slate-700" : "border-ink bg-ink text-white"
                }`}
              >
                전체
              </Link>
              {hotTags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/kids?${new URLSearchParams({ ...(q ? { q } : {}), tag: tag.slug }).toString()}`}
                  aria-current={tagSlug === tag.slug ? "page" : undefined}
                  className={`whitespace-nowrap rounded-md border px-3 py-2 text-sm font-bold ${
                    tagSlug === tag.slug ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      <KidsPlaylistPanel />

      {recommendedVideos.length > 0 && (
        <section className="mx-auto grid max-w-6xl gap-4 px-4 pt-6 md:px-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-ink">부모님 최근 추천</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recommendedVideos.map((video) => (
              <KidsVideoCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:grid-cols-2 md:px-8 lg:grid-cols-3">
        {videos.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 md:col-span-2 lg:col-span-3">
            볼 수 있는 영상이 없습니다.
          </div>
        )}
        {videos.map((video) => (
          <KidsVideoCard key={video.id} video={video} />
        ))}
      </section>
    </main>
  );
}
