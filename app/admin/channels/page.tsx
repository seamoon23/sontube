import Link from "next/link";
import { SafetyStatus } from "@prisma/client";
import { ChannelManager } from "@/components/admin/channel-manager";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminChannelsPage() {
  const session = await requireAdminSession();
  const channels = await prisma.channel.findMany({
    where: { familyId: session.familyId },
    include: {
      videos: {
        select: {
          id: true,
          isPublished: true,
          safetyStatus: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ocean">채널</p>
          <h2 className="text-2xl font-bold text-ink">등록 채널 관리</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            보호자가 직접 등록한 영상의 채널 묶음입니다. 이름과 사용 여부를 관리하거나 중복
            채널을 합칠 수 있습니다. YouTube 채널의 전체 영상과 연결하거나 자동 수집하지
            않습니다.
          </p>
        </div>
        <Link
          href="/admin/videos/new"
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          새 영상 등록
        </Link>
      </div>

      {channels.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          아직 등록된 채널이 없습니다. 영상 등록 화면에서 기존 채널을 선택하거나 새 채널을
          만들 수 있습니다.
        </div>
      ) : (
        <ChannelManager
          channels={channels.map((channel) => ({
            id: channel.id,
            displayName: channel.displayName,
            isActive: channel.isActive,
            videoCount: channel.videos.length,
            approvedVideoCount: channel.videos.filter(
              (video) =>
                video.isPublished && video.safetyStatus === SafetyStatus.PARENT_CHECKED,
            ).length,
          }))}
        />
      )}
    </div>
  );
}