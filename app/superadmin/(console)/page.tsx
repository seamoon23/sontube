import Link from "next/link";
import { FlashMessage } from "@/components/superadmin/flash-message";
import { PaymentStatusBadge } from "@/components/superadmin/status-badge";
import { prisma } from "@/lib/db";
import { requireSuperAdminSession } from "@/lib/superadmin-session";

export const dynamic = "force-dynamic";

type DashboardProps = {
  searchParams: Promise<{ notice?: string; error?: string }>;
};

export default async function SuperAdminDashboardPage({ searchParams }: DashboardProps) {
  await requireSuperAdminSession();
  const params = await searchParams;
  const now = new Date();
  const [
    totalFamilies,
    activeFamilies,
    activeUsers,
    pendingPayments,
    pendingRefunds,
    activeSubscriptions,
    recentPayments,
    recentAudits,
  ] = await Promise.all([
    prisma.family.count(),
    prisma.family.count({ where: { isActive: true } }),
    prisma.parentUser.count({ where: { isActive: true, family: { isActive: true } } }),
    prisma.paymentRequest.count({ where: { status: "PENDING" } }),
    prisma.paymentRefund.count({ where: { status: "REQUESTED" } }),
    prisma.familySubscription.count({ where: { status: "ACTIVE", expiresAt: { gt: now } } }),
    prisma.paymentRequest.findMany({
      take: 6,
      orderBy: { requestedAt: "desc" },
      include: {
        family: { select: { name: true } },
        requestedBy: { select: { displayName: true } },
      },
    }),
    prisma.superAdminAuditLog.findMany({
      take: 7,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="grid gap-6">
      <FlashMessage notice={params.notice} error={params.error} />

      <div>
        <p className="text-sm font-extrabold text-teal-700">운영 현황</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
          확인이 필요한 항목부터 봅니다
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          결제 대기, 환불 요청, 사용자 활성 상태를 한 화면에서 확인합니다.
        </p>
      </div>

      <section aria-label="주요 운영 지표" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 lg:grid-cols-6">
        <Metric label="전체 가족" value={totalFamilies} />
        <Metric label="활성 가족" value={activeFamilies} />
        <Metric label="활성 보호자" value={activeUsers} />
        <Metric label="활성 이용권" value={activeSubscriptions} />
        <Metric label="입금 확인 대기" value={pendingPayments} urgent={pendingPayments > 0} />
        <Metric label="환불 처리 대기" value={pendingRefunds} urgent={pendingRefunds > 0} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 id="recent-payments-title" className="text-lg font-black text-slate-950">최근 입금 신청</h3>
              <p className="mt-1 text-sm text-slate-500">최근 신청 6건</p>
            </div>
            <Link href="/superadmin/payments" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:border-teal-600 hover:text-teal-800">
              전체 보기
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <EmptyState text="아직 입금 신청이 없습니다." />
          ) : (
            <div
              role="region"
              aria-labelledby="recent-payments-title"
              tabIndex={0}
              className="overflow-x-auto focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-600"
            >
              <table className="w-full min-w-[680px] text-left text-sm">
                <caption className="sr-only">최근 입금 신청 6건</caption>
                <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3">신청번호</th>
                    <th scope="col" className="px-4 py-3">가족</th>
                    <th scope="col" className="px-4 py-3">금액</th>
                    <th scope="col" className="px-4 py-3">상태</th>
                    <th scope="col" className="px-5 py-3 text-right">접수</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment) => (
                    <tr key={payment.id} className="border-t border-slate-100 align-middle">
                      <td className="px-5 py-4">
                        <Link href={`/superadmin/payments/${payment.id}`} className="font-mono text-xs font-bold text-teal-800 hover:underline">
                          {payment.requestNo}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <p className="break-words font-bold text-slate-900">{payment.family.name}</p>
                        <p className="mt-1 break-words text-xs text-slate-500">{payment.requestedBy.displayName}</p>
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-slate-800">{formatKrw(payment.amountKrw)}</td>
                      <td className="px-4 py-4"><PaymentStatusBadge status={payment.status} /></td>
                      <td className="px-5 py-4 text-right text-xs text-slate-500">{formatDateTime(payment.requestedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-950">최근 관리자 작업</h3>
            <Link href="/superadmin/audit" className="inline-flex min-h-11 items-center text-sm font-bold text-teal-800 hover:underline">전체 보기</Link>
          </div>
          {recentAudits.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">기록된 작업이 없습니다.</p>
          ) : (
            <ol className="mt-4 grid gap-4">
              {recentAudits.map((audit) => (
                <li key={audit.id} className="grid gap-1 border-l-2 border-teal-200 pl-3">
                  <p className="text-sm font-bold text-slate-900">{formatAuditAction(audit.action)}</p>
                  <p className="break-all text-xs text-slate-500">{audit.actorId} / {formatDateTime(audit.createdAt)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, urgent = false }: { label: string; value: number; urgent?: boolean }) {
  return (
    <div className="min-h-28 bg-white p-4 md:p-5">
      <p className="text-xs font-bold leading-5 text-slate-500">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-black ${urgent ? "text-red-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-sm text-slate-500">{text}</p>;
}

function formatKrw(value: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(value);
}

function formatAuditAction(action: string): string {
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
