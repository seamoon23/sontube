import Link from "next/link";
import { KidsPlaylistPanel } from "@/components/kids/kids-playlist-controls";
import { KidsVideoCard } from "@/components/kids/video-card";
import { prisma } from "@/lib/db";
import { buildKidsVideoWhere } from "@/lib/kids-query";
import { SafetyStatus } from "@prisma/client";
import { requireAdminSession } from "@/lib/admin-session";

type KidsPageProps = {
  searchParams: Promise<{
    q?: string;
    tag?: string;
  }>;
};

export default async function KidsPage({ searchParams }: KidsPageProps) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const tagSlug = params.tag ?? "";
  const hasActiveFilters = Boolean(q || tagSlug);
  const visibleVideoWhere = {
    familyId: session.familyId,
    isPublished: true,
    safetyStatus: SafetyStatus.PARENT_CHECKED,
  };
  const videoWhere = { familyId: session.familyId, ...buildKidsVideoWhere({ q, tagSlug }) };

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
      where: { familyId: session.familyId, ...buildKidsVideoWhere({ parentRecommendedOnly: true }) },
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
        familyId: session.familyId,
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
    <div className="min-h-[100dvh] bg-slate-50">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[200] rounded-md bg-ink px-4 py-3 text-sm font-black text-white shadow-soft focus:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
      >
        영상 목록으로 건너뛰기
      </a>
      <header className="border-b border-slate-200 bg-white px-4 py-5 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-4">
          <div>
            <p className="text-sm font-semibold text-ocean">SonTube</p>
            <h1 className="text-3xl font-black text-ink md:text-4xl">영상서랍</h1>
          </div>
          <form className="grid gap-3 md:grid-cols-[1fr_auto]" role="search" aria-label="승인 영상 검색">
            <label htmlFor="kids-search" className="sr-only">
              제목 또는 부모님 키워드 검색
            </label>
            <input
              id="kids-search"
              name="q"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              defaultValue={q}
              placeholder="제목 또는 부모님 키워드 검색"
              className="min-h-11 rounded-md border border-slate-300 px-4 py-3 text-base outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
            />
            {tagSlug && <input type="hidden" name="tag" value={tagSlug} />}
            <button type="submit" className="min-h-11 rounded-md bg-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none">
              찾기
            </button>
          </form>
          {hotTags.length > 0 && (
            <nav className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1" aria-label="영상 태그">
              <Link
                href={q ? `/kids?q=${encodeURIComponent(q)}` : "/kids"}
                aria-current={tagSlug ? undefined : "page"}
                className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md border px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 ${
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
                  className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md border px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 ${
                    tagSlug === tag.slug ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {tag.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main id="main-content">
        <KidsPlaylistPanel />

        {recommendedVideos.length > 0 && (
          <section className="mx-auto grid max-w-6xl gap-4 px-4 pt-6 md:px-8" aria-labelledby="recommended-videos-title">
            <div className="flex items-center justify-between">
              <h2 id="recommended-videos-title" className="text-xl font-black text-ink">부모님 최근 추천</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recommendedVideos.map((video) => (
                <KidsVideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:grid-cols-2 md:px-8 lg:grid-cols-3" aria-labelledby="all-videos-title">
          <div className="flex items-center justify-between gap-3 md:col-span-2 lg:col-span-3">
            <h2 id="all-videos-title" className="text-xl font-black text-ink">
              {hasActiveFilters ? "찾은 영상" : "전체 영상"}
            </h2>
            <span className="shrink-0 text-sm font-bold text-slate-500">{videos.length}개</span>
          </div>
          {videos.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center md:col-span-2 lg:col-span-3" role="status">
              <h3 className="font-black text-ink">
                {hasActiveFilters ? "조건에 맞는 영상이 없습니다" : "볼 수 있는 영상이 없습니다"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {hasActiveFilters
                  ? "검색어나 태그를 바꾸고 다시 살펴보세요."
                  : "부모님이 확인한 영상이 등록되면 이곳에 나타납니다."}
              </p>
              {hasActiveFilters && (
                <Link
                  href="/kids"
                  className="mt-4 inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-ocean hover:text-ocean focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                  전체 영상 보기
                </Link>
              )}
            </div>
          )}
          {videos.map((video) => (
            <KidsVideoCard key={video.id} video={video} />
          ))}
        </section>
      </main>
    </div>
  );
}
