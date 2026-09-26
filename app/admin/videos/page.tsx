import Link from "next/link";
import { prisma } from "@/lib/db";
import { getThumbnailUrl } from "@/lib/thumbnails";
import { requireAdminSession } from "@/lib/admin-session";
import { buildAdminVideoWhere, UNASSIGNED_CHANNEL_FILTER } from "@/lib/admin-video-filters";

export const dynamic = "force-dynamic";

type VideosPageProps = {
  searchParams: Promise<{
    q?: string;
    tag?: string;
    channel?: string;
    status?: string;
    recommended?: string;
    thumbnail?: string;
  }>;
};

export default async function AdminVideosPage({ searchParams }: VideosPageProps) {
  const session = await requireAdminSession();

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const tagId = params.tag ?? "";
  const channelId = params.channel ?? "";
  const status = params.status ?? "";
  const recommended = params.recommended ?? "";
  const thumbnail = params.thumbnail ?? "";
  const where = {
    familyId: session.familyId,
    ...buildAdminVideoWhere({ q, tagId, channelId, status, recommended, thumbnail }),
  };

  const [videos, tags, channels] = await Promise.all([
    prisma.video.findMany({
      where,
      include: {
        channel: true,
        tags: {
          include: { tag: true },
          orderBy: { tag: { sortOrder: "asc" } },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.tag.findMany({
      where: { familyId: session.familyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.channel.findMany({
      where: { familyId: session.familyId },
      orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
      select: { id: true, displayName: true, isActive: true },
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
          className="inline-flex min-h-11 items-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          새 영상
        </Link>
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs font-semibold text-slate-600 md:col-span-2">
          검색
          <input
            name="q"
            defaultValue={q}
            placeholder="제목, 설명, 채널, videoId"
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          태그
          <select name="tag" defaultValue={tagId} className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">모든 태그</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          채널
          <select
            name="channel"
            defaultValue={channelId}
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">모든 채널</option>
            <option value={UNASSIGNED_CHANNEL_FILTER}>채널 미지정</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.displayName}{channel.isActive ? "" : " (사용 중지)"}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          상태
          <select name="status" defaultValue={status} className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">모든 상태</option>
            <option value="published">공개</option>
            <option value="review">검토 필요</option>
            <option value="hidden">숨김</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          추천
          <select
            name="recommended"
            defaultValue={recommended}
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            <option value="1">부모 추천</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          썸네일
          <select
            name="thumbnail"
            defaultValue={thumbnail}
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">모든 썸네일</option>
            <option value="YOUTUBE">YouTube 기본</option>
            <option value="CUSTOM">커스텀</option>
            <option value="PLACEHOLDER">Placeholder</option>
          </select>
        </label>
        <button type="submit" className="min-h-11 self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
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
            <img src={getThumbnailUrl(video)} alt="" loading="lazy" decoding="async" className="aspect-video w-full rounded-md object-cover" />
            <div className="grid min-w-0 gap-2">
              <div>
                <h3 className="break-words text-lg font-semibold text-ink">{video.title}</h3>
                <p className="break-all text-xs text-slate-500">{video.youtubeVideoId}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {video.isLitePublished && (
                  <span className="rounded-md bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">
                    Lite 공개 · 순서 {video.liteSortOrder}
                  </span>
                )}
                {video.channel ? (
                  <Link
                    href={{ pathname: "/admin/videos", query: { channel: video.channel.id } }}
                    className="inline-flex min-h-11 items-center rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                    title={`${video.channel.displayName} 채널 영상만 보기`}
                  >
                    채널 · {video.channel.displayName}
                  </Link>
                ) : (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                    채널 미지정
                  </span>
                )}
                {video.tags.map(({ tag }) => (
                  <span
                    key={tag.id}
                    className="rounded-md px-2 py-1 text-xs font-semibold"
                    style={{ backgroundColor: `${tag.color ?? "#0369a1"}22`, color: "#334155" }}
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
                aria-label={`${video.title} 수정`}
                className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-ocean hover:text-ocean"
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
