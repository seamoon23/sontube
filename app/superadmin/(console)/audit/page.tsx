import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperAdminSession } from "@/lib/superadmin-session";

export const dynamic = "force-dynamic";

type AuditPageProps = {
  searchParams: Promise<{ kind?: string; q?: string }>;
};

type AuditRow = {
  id: string;
  kind: "ADMIN" | "PAYMENT";
  action: string;
  actor: string;
  target: string;
  detail: string | null;
  createdAt: Date;
  paymentId?: string;
};

export default async function SuperAdminAuditPage({ searchParams }: AuditPageProps) {
  await requireSuperAdminSession();
  const params = await searchParams;
  const kind = params.kind === "ADMIN" || params.kind === "PAYMENT" ? params.kind : "";
  const q = params.q?.trim().toLocaleLowerCase("ko-KR") ?? "";
  const [adminLogs, paymentLogs] = await Promise.all([
    prisma.superAdminAuditLog.findMany({ take: 120, orderBy: { createdAt: "desc" } }),
    prisma.paymentAuditLog.findMany({
      take: 120,
      orderBy: { createdAt: "desc" },
      include: {
        paymentRequest: { select: { id: true, requestNo: true, family: { select: { name: true } } } },
      },
    }),
  ]);

  const familyIds = Array.from(new Set(adminLogs.flatMap((log) => log.targetFamilyId ? [log.targetFamilyId] : [])));
  const userIds = Array.from(new Set(adminLogs.flatMap((log) => log.targetUserId ? [log.targetUserId] : [])));
  const [families, users] = await Promise.all([
    familyIds.length ? prisma.family.findMany({ where: { id: { in: familyIds } }, select: { id: true, name: true } }) : [],
    userIds.length ? prisma.parentUser.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true, email: true } }) : [],
  ]);
  const familyNames = new Map(families.map((family) => [family.id, family.name]));
  const userNames = new Map(users.map((user) => [user.id, `${user.displayName} (${user.email})`]));

  const rows: AuditRow[] = [
    ...adminLogs.map((log): AuditRow => ({
      id: `admin-${log.id}`,
      kind: "ADMIN",
      action: formatAdminAction(log.action),
      actor: log.actorId,
      target: [
        log.targetFamilyId ? familyNames.get(log.targetFamilyId) ?? log.targetFamilyId : null,
        log.targetUserId ? userNames.get(log.targetUserId) ?? log.targetUserId : null,
      ].filter(Boolean).join(" / ") || "서비스 설정",
      detail: summarizeMetadata(log.metadataJson),
      createdAt: log.createdAt,
    })),
    ...paymentLogs.map((log): AuditRow => ({
      id: `payment-${log.id}`,
      kind: "PAYMENT",
      action: formatPaymentAction(log.action),
      actor: log.actorId || log.actorType,
      target: `${log.paymentRequest.family.name} / ${log.paymentRequest.requestNo}`,
      detail: log.memo,
      createdAt: log.createdAt,
      paymentId: log.paymentRequest.id,
    })),
  ]
    .filter((row) => !kind || row.kind === kind)
    .filter((row) => !q || `${row.action} ${row.actor} ${row.target} ${row.detail ?? ""}`.toLocaleLowerCase("ko-KR").includes(q))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 200);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-extrabold text-teal-700">감사 로그</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">최근 운영 작업 기록</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">최종관리자 계정 작업과 결제 상태 변경을 시간순으로 확인합니다.</p>
      </div>

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
        <label className="grid gap-2 text-sm font-bold text-slate-700">기록 구분
          <select name="kind" defaultValue={kind} className={inputClass}>
            <option value="">전체 기록</option>
            <option value="ADMIN">계정·설정</option>
            <option value="PAYMENT">결제·이용권</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">작업, 담당자, 대상 검색
          <input name="q" defaultValue={params.q ?? ""} className={inputClass} />
        </label>
        <button className="min-h-11 self-end rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-bold text-slate-800 hover:border-teal-600 hover:text-teal-800">검색</button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-black text-slate-950">기록 목록</h3>
          <p className="text-sm font-bold text-slate-500">최근 {rows.length}건</p>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">조건에 맞는 감사 기록이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-5 py-3">시각</th>
                  <th className="px-4 py-3">구분</th>
                  <th className="px-4 py-3">작업</th>
                  <th className="px-4 py-3">담당자</th>
                  <th className="px-4 py-3">대상</th>
                  <th className="px-5 py-3">세부 내용</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{formatDateTime(row.createdAt)}</td>
                    <td className="px-4 py-4"><span className={`rounded-md border px-2 py-1 text-xs font-bold ${row.kind === "ADMIN" ? "border-teal-200 bg-teal-50 text-teal-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}>{row.kind === "ADMIN" ? "계정·설정" : "결제·이용권"}</span></td>
                    <td className="px-4 py-4 font-bold text-slate-900">{row.action}</td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-600">{row.actor}</td>
                    <td className="px-4 py-4 text-slate-700">{row.paymentId ? <Link href={`/superadmin/payments/${row.paymentId}`} className="font-bold text-teal-800 hover:underline">{row.target}</Link> : row.target}</td>
                    <td className="max-w-md whitespace-pre-wrap px-5 py-4 text-xs leading-5 text-slate-600">{row.detail || "없음"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const inputClass = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

function summarizeMetadata(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return [
      typeof parsed.reason === "string" ? `사유: ${parsed.reason}` : null,
      typeof parsed.email === "string" ? `이메일: ${parsed.email}` : null,
      typeof parsed.code === "string" ? `코드: ${parsed.code}` : null,
      typeof parsed.expiresAt === "string" ? `만료: ${parsed.expiresAt}` : null,
    ].filter(Boolean).join(" / ") || "상세 값 기록됨";
  } catch {
    return "상세 값 형식 오류";
  }
}

function formatAdminAction(action: string): string {
  const labels: Record<string, string> = {
    FAMILY_CREATED: "가족과 대표 보호자 생성",
    FAMILY_ACTIVATED: "가족 활성화",
    FAMILY_DEACTIVATED: "가족 비활성화",
    PARENT_USER_CREATED: "보호자 계정 추가",
    PARENT_USER_ACTIVATED: "보호자 계정 활성화",
    PARENT_USER_DEACTIVATED: "보호자 계정 비활성화",
    PARENT_PASSWORD_RESET: "보호자 비밀번호 재설정",
    IMPERSONATION_STARTED: "대체 로그인 시작",
    IMPERSONATION_ENDED: "대체 로그인 종료",
    PAYMENT_PLAN_CREATED: "요금제 생성",
    PAYMENT_PLAN_UPDATED: "요금제 수정",
    PAYMENT_PLAN_ACTIVATED: "요금제 활성화",
    PAYMENT_PLAN_DEACTIVATED: "요금제 비활성화",
  };
  return labels[action] ?? action;
}

function formatPaymentAction(action: string): string {
  const labels: Record<string, string> = {
    PAYMENT_REQUESTED: "입금 신청 접수",
    PAYMENT_CONFIRMED: "입금 확인 완료",
    PAYMENT_REJECTED: "입금 확인 불가 처리",
    PAYMENT_EXPIRED: "신청 만료 처리",
    REFUND_REQUESTED: "환불 요청 접수",
    REFUND_REJECTED: "환불 요청 반려",
    REFUND_COMPLETED: "환불 완료",
    SUBSCRIPTION_CREATED: "가족 이용권 생성",
    SUBSCRIPTION_EXTENDED: "가족 이용권 연장",
    ADMIN_MEMO_UPDATED: "관리자 메모 수정",
  };
  return labels[action] ?? action;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "medium" }).format(value);
}
