import { PaymentRequestStatus } from "@prisma/client";
import Link from "next/link";
import { FlashMessage } from "@/components/superadmin/flash-message";
import { PaymentStatusBadge } from "@/components/superadmin/status-badge";
import { prisma } from "@/lib/db";
import { requireSuperAdminSession } from "@/lib/superadmin-session";

export const dynamic = "force-dynamic";

const statusOptions = [
  { value: "", label: "전체" },
  { value: "PENDING", label: "입금 대기" },
  { value: "CONFIRMED", label: "확인 완료" },
  { value: "REFUND_REQUESTED", label: "환불 대기" },
  { value: "REFUNDED", label: "환불 완료" },
  { value: "REJECTED", label: "확인 불가" },
  { value: "EXPIRED", label: "만료" },
] as const;

type PaymentsPageProps = {
  searchParams: Promise<{ status?: string; q?: string; notice?: string; error?: string }>;
};

export default async function SuperAdminPaymentsPage({ searchParams }: PaymentsPageProps) {
  await requireSuperAdminSession();
  const params = await searchParams;
  const status = isPaymentStatus(params.status) ? params.status : undefined;
  const q = params.q?.trim() ?? "";
  const [payments, grouped] = await Promise.all([
    prisma.paymentRequest.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { requestNo: { contains: q } },
                { depositorName: { contains: q } },
                { family: { name: { contains: q } } },
                { requestedBy: { email: { contains: q } } },
                { requestedBy: { displayName: { contains: q } } },
              ],
            }
          : {}),
      },
      take: 100,
      orderBy: { requestedAt: "desc" },
      include: {
        family: { select: { name: true } },
        requestedBy: { select: { displayName: true, email: true } },
      },
    }),
    prisma.paymentRequest.groupBy({ by: ["status"], _count: { status: true } }),
  ]);
  const counts = new Map(grouped.map((item) => [item.status, item._count.status]));
  const total = grouped.reduce((sum, item) => sum + item._count.status, 0);

  return (
    <div className="grid gap-6">
      <FlashMessage notice={params.notice} error={params.error} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold text-teal-700">입금 신청</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">수동 입금 확인과 환불 처리</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            신청 금액과 실제 입금액이 일치할 때만 승인됩니다. 승인과 환불은 이용기간과 감사 기록에 함께 반영됩니다.
          </p>
        </div>
        <a
          href="/api/superadmin/payments/export"
          download
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:border-teal-600 hover:text-teal-800"
        >
          전체 CSV 내려받기
        </a>
      </div>

      <nav aria-label="입금 신청 상태" className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2">
        <div className="flex min-w-max gap-1">
          {statusOptions.map((option) => {
            const active = (status ?? "") === option.value;
            const count = option.value ? counts.get(option.value as PaymentRequestStatus) ?? 0 : total;
            const query = new URLSearchParams({ ...(option.value ? { status: option.value } : {}), ...(q ? { q } : {}) });
            return (
              <Link
                key={option.value || "all"}
                href={`/superadmin/payments${query.size ? `?${query.toString()}` : ""}`}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-bold transition ${active ? "bg-teal-50 text-teal-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
              >
                {option.label} <span className="font-mono">{count}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          신청번호, 입금자, 가족, 보호자 검색
          <input name="q" defaultValue={q} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100" />
        </label>
        <button className="min-h-11 self-end rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-bold text-slate-800 hover:border-teal-600 hover:text-teal-800">검색</button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <h3 id="payment-results-title" className="text-lg font-black text-slate-950">신청 목록</h3>
          <p className="text-sm font-bold text-slate-500">검색 결과 {payments.length}건</p>
        </div>
        {payments.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">조건에 맞는 입금 신청이 없습니다.</div>
        ) : (
          <div
            role="region"
            aria-labelledby="payment-results-title"
            tabIndex={0}
            className="overflow-x-auto focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-600"
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <caption className="sr-only">검색 조건에 맞는 입금 신청 목록</caption>
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">신청번호</th>
                  <th scope="col" className="px-4 py-3">가족 / 신청자</th>
                  <th scope="col" className="px-4 py-3">입금자 / 예정일</th>
                  <th scope="col" className="px-4 py-3">상품</th>
                  <th scope="col" className="px-4 py-3 text-right">금액</th>
                  <th scope="col" className="px-4 py-3">상태</th>
                  <th scope="col" className="px-5 py-3 text-right">신청 시각</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <Link href={`/superadmin/payments/${payment.id}`} className="font-mono text-xs font-bold text-teal-800 hover:underline">{payment.requestNo}</Link>
                    </td>
                    <td className="px-4 py-4">
                      <p className="break-words font-bold text-slate-900">{payment.family.name}</p>
                      <p className="mt-1 break-words text-xs text-slate-500">{payment.requestedBy.displayName}</p>
                      <p className="mt-1 max-w-56 break-all text-xs text-slate-500">{payment.requestedBy.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="break-words font-bold text-slate-800">{payment.depositorName}</p>
                      <p className="mt-1 text-xs text-slate-500">{payment.expectedDepositDate || "미입력"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="break-words font-bold text-slate-800">{payment.planNameSnapshot}</p>
                      <p className="mt-1 text-xs text-slate-500">{payment.durationDaysSnapshot}일</p>
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-black text-slate-900">{formatKrw(payment.amountKrw)}</td>
                    <td className="px-4 py-4"><PaymentStatusBadge status={payment.status} /></td>
                    <td className="px-5 py-4 text-right text-xs text-slate-500">{formatDateTime(payment.requestedAt)}</td>
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

function isPaymentStatus(value: string | undefined): value is PaymentRequestStatus {
  return Boolean(value && Object.values(PaymentRequestStatus).includes(value as PaymentRequestStatus));
}

function formatKrw(value: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(value);
}
