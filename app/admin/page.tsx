import Link from "next/link";
import { SafetyStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-session";
import { updateWifiRequiredAction } from "@/app/admin/settings-actions";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();
  const familyWhere = { familyId: session.familyId };

  const [totalVideos, publishedVideos, reviewVideos, tags, family] = await Promise.all([
    prisma.video.count({ where: familyWhere }),
    prisma.video.count({
      where: { ...familyWhere, isPublished: true, safetyStatus: SafetyStatus.PARENT_CHECKED },
    }),
    prisma.video.count({ where: { ...familyWhere, safetyStatus: SafetyStatus.NEEDS_REVIEW } }),
    prisma.tag.count({ where: { ...familyWhere, isActive: true } }),
    prisma.family.findUniqueOrThrow({
      where: { id: session.familyId },
    }),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ocean">{family.name}</p>
          <h2 className="text-2xl font-bold text-ink">오늘의 관리 상태</h2>
          <p className="mt-1 text-sm text-slate-600">{session.displayName}님 계정으로 관리 중입니다.</p>
        </div>
        <Link href="/admin/videos/new" className="inline-flex min-h-11 items-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          영상 등록
        </Link>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="전체 영상" value={totalVideos} tone="bg-white" />
        <Metric label="아이 화면 공개" value={publishedVideos} tone="bg-sky-50" />
        <Metric label="검토 필요" value={reviewVideos} tone="bg-amber-50" />
        <Metric label="활성 태그" value={tags} tone="bg-green-50" />
      </section>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs font-bold text-ocean">무료 가족 이용</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">
            영상 {totalVideos} / {family.videoLimit}개
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            기본 한도는 가족당 20개이며 운영자가 무료로 승인한 가족은 한도가 다를 수 있습니다. 기간 제한이나 결제는 없습니다.
          </p>
          {totalVideos >= family.videoLimit && <p className="mt-2 text-sm font-semibold text-amber-800">등록 한도에 도달했습니다. 기존 영상은 계속 관리하고 시청할 수 있습니다.</p>}
        </div>
        <Link href="/admin/payment" className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-ocean hover:text-ocean">
          무료 이용 안내
        </Link>
      </section>

      <form action={updateWifiRequiredAction} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold text-ocean">대시보드 &gt; 앱 접속 정책</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">승인 목록 통신 환경</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            켜면 Android 앱은 시작할 때 이 설정을 먼저 확인하고 Wi-Fi에서만 승인 목록을 확인합니다. 설정을 확인할 수 없거나
            Wi-Fi가 아니면 실제 목록 대신 재생되지 않는 샘플 화면을 보여줍니다.
          </p>
        </div>
        <label className="flex items-start gap-3 rounded-md bg-slate-50 p-4 text-sm text-slate-700">
          <input type="checkbox" name="wifiRequired" defaultChecked={family.wifiRequired} disabled={Boolean(session.impersonatedBy)} className="mt-1 h-4 w-4 rounded border-slate-300 text-ocean focus:ring-ocean disabled:cursor-not-allowed disabled:opacity-50" />
          <span>
            <strong className="block text-ink">Wi-Fi 연결 필수</strong>
            끄면 Wi-Fi와 모바일 데이터 모두에서 새 승인 목록을 받을 수 있습니다.
          </span>
        </label>
        <div>
          <button type="submit" disabled={Boolean(session.impersonatedBy)} className="min-h-11 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300">정책 저장</button>
          {session.impersonatedBy ? (
            <p className="mt-2 text-xs font-semibold text-purple-800">대체 로그인에서는 정책을 변경할 수 없습니다.</p>
          ) : null}
        </div>
      </form>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-ink">바로가기</h3>
        <div className="grid gap-3 md:grid-cols-5">
          <Link className="rounded-md border border-slate-200 p-4 text-sm font-semibold hover:border-ocean" href="/admin/videos">영상 목록</Link>
          <Link className="rounded-md border border-slate-200 p-4 text-sm font-semibold hover:border-ocean" href="/admin/tags">태그 관리</Link>
          <Link className="rounded-md border border-slate-200 p-4 text-sm font-semibold hover:border-ocean" href="/admin/insights">관심 요약</Link>
          <Link className="rounded-md border border-slate-200 p-4 text-sm font-semibold hover:border-ocean" href="/admin/app-keys">앱 키</Link>
          <Link className="rounded-md border border-slate-200 p-4 text-sm font-semibold hover:border-ocean" href="/kids">아이 화면 확인</Link>
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
