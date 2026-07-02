import Link from "next/link";
import { SafetyStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminSession();

  const [totalVideos, publishedVideos, reviewVideos, tags] = await Promise.all([
    prisma.video.count(),
    prisma.video.count({ where: { isPublished: true, safetyStatus: SafetyStatus.PARENT_CHECKED } }),
    prisma.video.count({ where: { safetyStatus: SafetyStatus.NEEDS_REVIEW } }),
    prisma.tag.count({ where: { isActive: true } }),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ocean">대시보드</p>
          <h2 className="text-2xl font-bold text-ink">오늘의 관리 상태</h2>
        </div>
        <Link
          href="/admin/videos/new"
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          영상 등록
        </Link>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="전체 영상" value={totalVideos} tone="bg-white" />
        <Metric label="아이 화면 공개" value={publishedVideos} tone="bg-sky-50" />
        <Metric label="검토 필요" value={reviewVideos} tone="bg-amber-50" />
        <Metric label="활성 태그" value={tags} tone="bg-green-50" />
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-ink">바로가기</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <Link className="rounded-md border border-slate-200 p-4 text-sm font-semibold hover:border-ocean" href="/admin/videos">
            영상 목록
          </Link>
          <Link className="rounded-md border border-slate-200 p-4 text-sm font-semibold hover:border-ocean" href="/admin/tags">
            태그 관리
          </Link>
          <Link
            className="rounded-md border border-slate-200 p-4 text-sm font-semibold hover:border-ocean"
            href="/admin/insights"
          >
            관심 요약
          </Link>
          <Link className="rounded-md border border-slate-200 p-4 text-sm font-semibold hover:border-ocean" href="/kids">
            아이 화면 확인
          </Link>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 p-5 shadow-sm ${tone}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}
