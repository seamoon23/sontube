import { AppKeyManager, type ManagedAppAccessKey } from "@/components/admin/app-key-manager";
import { getAppAccessState } from "@/lib/app-access";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminAppKeysPage() {
  await requireAdminSession();

  const keys = await prisma.appAccessKey.findMany({
    orderBy: { createdAt: "desc" },
  });

  const managedKeys: ManagedAppAccessKey[] = keys.map((key) => {
    const state = getAppAccessState(key);

    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      isActive: key.isActive,
      status: state.status,
      statusLabel: state.label,
      canSync: state.canSync,
      trialStartedAt: key.trialStartedAt.toISOString(),
      trialEndsAt: key.trialEndsAt.toISOString(),
      paidUntil: key.paidUntil?.toISOString() ?? null,
      lastSyncedAt: key.lastSyncedAt?.toISOString() ?? null,
      createdAt: key.createdAt.toISOString(),
    };
  });

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold text-ocean">앱 설정</p>
        <h1 className="text-2xl font-bold text-ink">동기화 앱 키</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          관리자 웹에서 승인한 영상 목록을 앱이 가져갈 때 사용하는 키입니다. 키가 없는 앱은 콘텐츠를 동기화할 수 없습니다.
        </p>
      </div>
      <AppKeyManager keys={managedKeys} />
    </div>
  );
}