import { Prisma, SafetyStatus } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getThumbnailUrl } from "@/lib/thumbnails";
import { requireAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

type VideosPageProps = {
  searchParams: Promise<{
    q?: string;
    tag?: string;
    status?: string;
  }>;
};

export default async function AdminVideosPage({ searchParams }: VideosPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const tagId = params.tag ?? "";
  const status = params.status ?? "";
  const where: Prisma.VideoWhereInput = {};

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
      { searchKeywords: { contains: q } },
      { youtubeVideoId: { contains: q } },
    ];
  }

  if (tagId) {
    where.tags = { some: { tagId } };
  }

  if (status === "published") {
    where.isPublished = true;
    where.safetyStatus = SafetyStatus.PARENT_CHECKED;
  } else if (status === "review") {
    where.safetyStatus = SafetyStatus.NEEDS_REVIEW;
  } else if (status === "hidden") {
    where.safetyStatus = SafetyStatus.HIDDEN;
  }

  const [videos, tags] = await Promise.all([
    prisma.video.findMany({
      where,
      include: {
        tags: {
          include: { tag: true },
          orderBy: { tag: { sortOrder: "asc" } },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.tag.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ocean">영상 목록</p>
          <h2 className="text-2xl font-bold text-ink">등록된 영상</h2>
        </div>
        <Link
          href="/admin/videos/new"
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          새 영상
        </Link>
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_180px_180px_auto]">
        <input
          name="q"
          defaultValue={q}
          placeholder="제목, 설명, videoId"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select name="tag" defaultValue={tagId} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">모든 태그</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">모든 상태</option>
          <option value="published">공개</option>
          <option value="review">검토 필요</option>
          <option value="hidden">숨김</option>
        </select>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          검색
        </button>
      </form>

      <section className="grid gap-3">
        {videos.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            등록된 영상이 없습니다.
          </div>
        )}

        {videos.map((video) => (
          <article key={video.id} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[180px_1fr_auto]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getThumbnailUrl(video)} alt="" className="aspect-video w-full rounded-md object-cover" />
            <div className="grid gap-2">
              <div>
                <h3 className="text-lg font-semibold text-ink">{video.title}</h3>
                <p className="text-xs text-slate-500">{video.youtubeVideoId}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {video.tags.map(({ tag }) => (
                  <span
                    key={tag.id}
                    className="rounded-md px-2 py-1 text-xs font-semibold"
                    style={{ backgroundColor: `${tag.color ?? "#0369a1"}22`, color: tag.color ?? "#0369a1" }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
              <p className="text-sm text-slate-600">
                {video.safetyStatus === "PARENT_CHECKED" ? "확인 완료" : video.safetyStatus === "HIDDEN" ? "숨김" : "검토 필요"} ·{" "}
                {video.isPublished ? "공개" : "비공개"} · {video.durationText ?? "시간 미입력"}
                {video.isParentRecommended ? " · 부모 추천" : ""}
              </p>
            </div>
            <div className="flex items-start justify-end">
              <Link
                href={`/admin/videos/${video.id}/edit`}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-ocean hover:text-ocean"
              >
                수정
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
