import { SafetyStatus } from "@prisma/client";
import Link from "next/link";
import { KidsVideoCard } from "@/components/kids/video-card";
import { prisma } from "@/lib/db";

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

  const [videos, hotTags] = await Promise.all([
    prisma.video.findMany({
      where: {
        ...visibleVideoWhere,
        ...(q
          ? {
              OR: [{ title: { contains: q } }, { description: { contains: q } }],
            }
          : {}),
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
      },
      include: {
        tags: {
          where: { tag: { isActive: true } },
          include: { tag: true },
          orderBy: { tag: { sortOrder: "asc" } },
        },
      },
      orderBy: { updatedAt: "desc" },
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
            <input
              name="q"
              defaultValue={q}
              placeholder="제목 검색"
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
