import Link from "next/link";
import { notFound } from "next/navigation";
import { FlashMessage } from "@/components/superadmin/flash-message";
import { PaymentStatusBadge } from "@/components/superadmin/status-badge";
import { SubmitButton } from "@/components/superadmin/submit-button";
import {
  confirmPaymentAction,
  resolvePendingPaymentAction,
  resolveRefundAction,
  updatePaymentMemoAction,
} from "@/app/superadmin/actions";
import { prisma } from "@/lib/db";
import { requireSuperAdminSession } from "@/lib/superadmin-session";

export const dynamic = "force-dynamic";

type PaymentDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

export default async function SuperAdminPaymentDetailPage({ params, searchParams }: PaymentDetailPageProps) {
  await requireSuperAdminSession();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const payment = await prisma.paymentRequest.findUnique({
    where: { id },
    include: {
      family: { include: { subscription: true } },
      requestedBy: true,
      plan: true,
      grant: true,
      refunds: { include: { requestedBy: true }, orderBy: { requestedAt: "desc" } },
      auditLogs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!payment) notFound();

  const returnTo = `/superadmin/payments/${payment.id}`;
  const pendingRefund = payment.refunds.find((refund) => refund.status === "REQUESTED");

  return (
    <div className="grid gap-6">
      <FlashMessage notice={query.notice} error={query.error} />

      <div>
        <Link href="/superadmin/payments" className="inline-flex min-h-11 items-center text-sm font-bold text-teal-800 hover:underline">입금 신청 목록으로</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h2 className="break-all font-mono text-xl font-black tracking-tight text-slate-950 md:text-2xl">{payment.requestNo}</h2>
          <PaymentStatusBadge status={payment.status} />
        </div>
        <p className="mt-2 text-sm text-slate-600">신청 내용과 실제 입금 정보를 대조한 뒤 처리하세요.</p>
      </div>

      <section className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="가족" value={payment.family.name} detail={payment.family.isActive ? "가족 활성" : "가족 비활성"} />
        <Summary label="신청 보호자" value={payment.requestedBy.displayName} detail={payment.requestedBy.email} />
        <Summary label="신청 상품" value={payment.planNameSnapshot} detail={`${payment.durationDaysSnapshot}일 / ${payment.planCodeSnapshot}`} />
        <Summary label="신청 금액" value={formatKrw(payment.amountKrw)} detail={`신청 ${formatDateTime(payment.requestedAt)}`} mono />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="grid content-start gap-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-black text-slate-950">입금 신청 정보</h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Info label="입금자명" value={payment.depositorName} />
              <Info label="입금 예정일" value={payment.expectedDepositDate || "미입력"} />
              <Info label="실제 입금액" value={payment.receivedAmountKrw !== null ? formatKrw(payment.receivedAmountKrw) : "미확인"} />
              <Info label="실제 입금일" value={payment.receivedDate || "미확인"} />
              <Info label="확인 시각" value={payment.confirmedAt ? formatDateTime(payment.confirmedAt) : "미처리"} />
              <Info label="확인 담당" value={payment.confirmedBy || payment.rejectedBy || payment.refundedBy || "미처리"} />
            </dl>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Memo label="사용자 메모" value={payment.userMemo} />
              <Memo label="관리자 메모" value={payment.adminMemo} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-black text-slate-950">이용권 반영</h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Info label="가족 이용권 상태" value={payment.family.subscription?.status ?? "없음"} />
              <Info label="가족 이용권 만료" value={payment.family.subscription ? formatDateTime(payment.family.subscription.expiresAt) : "없음"} />
              <Info label="이 결제 지급 시작" value={payment.grant ? formatDateTime(payment.grant.startsAt) : "없음"} />
              <Info label="이 결제 지급 만료" value={payment.grant ? formatDateTime(payment.grant.expiresAt) : "없음"} />
            </dl>
          </section>

          {payment.refunds.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-black text-slate-950">환불 기록</h3>
              <div className="mt-4 grid gap-3">
                {payment.refunds.map((refund) => (
                  <div key={refund.id} className="grid gap-2 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                    <Info label="상태" value={refund.status} />
                    <Info label="금액" value={formatKrw(refund.amountKrw)} />
                    <Info label="요청 시각" value={formatDateTime(refund.requestedAt)} />
                    <Info label="처리 시각" value={refund.processedAt ? formatDateTime(refund.processedAt) : "미처리"} />
                    <div className="sm:col-span-2"><Memo label="환불 사유" value={refund.reason} /></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-black text-slate-950">결제 감사 기록</h3>
            {payment.auditLogs.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">기록이 없습니다.</p>
            ) : (
              <ol className="mt-4 grid gap-4">
                {payment.auditLogs.map((log) => (
                  <li key={log.id} className="grid gap-1 border-l-2 border-teal-200 pl-3">
                    <p className="text-sm font-bold text-slate-900">{formatPaymentAuditAction(log.action)}</p>
                    <p className="break-all text-xs text-slate-500">{log.actorType} / {log.actorId || "시스템"} / {formatDateTime(log.createdAt)}</p>
                    {log.memo && <p className="break-words text-xs leading-5 text-slate-600">{log.memo}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-5">
          {payment.status === "PENDING" && (
            <section className="rounded-xl border border-teal-200 bg-white p-5">
              <h3 className="text-lg font-black text-slate-950">입금 승인</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">실제 입금액은 신청 금액과 정확히 일치해야 합니다.</p>
              <form action={confirmPaymentAction} className="mt-4 grid gap-4">
                <input type="hidden" name="paymentRequestId" value={payment.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <Field label="실제 입금액(원)"><input name="receivedAmountKrw" type="number" required min={1} max={100000000} defaultValue={payment.amountKrw} className={inputClass} /></Field>
                <Field label="실제 입금일"><input name="receivedDate" type="date" required defaultValue={todayInSeoul()} className={inputClass} /></Field>
                <Field label="관리자 메모"><textarea name="adminMemo" maxLength={2000} rows={3} defaultValue={payment.adminMemo ?? ""} className={inputClass} /></Field>
                <SubmitButton label="입금 확인 및 이용권 지급" pendingLabel="승인 중" />
              </form>
            </section>
          )}

          {payment.status === "PENDING" && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-black text-slate-950">확인 불가 또는 만료</h3>
              <form action={resolvePendingPaymentAction} className="mt-4 grid gap-4">
                <input type="hidden" name="paymentRequestId" value={payment.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <Field label="처리 유형">
                  <select name="resolution" required className={inputClass} defaultValue="REJECTED">
                    <option value="REJECTED">입금 확인 불가</option>
                    <option value="EXPIRED">신청 만료</option>
                  </select>
                </Field>
                <Field label="처리 사유"><textarea name="adminMemo" required maxLength={2000} rows={3} className={inputClass} /></Field>
                <SubmitButton label="선택 상태로 처리" pendingLabel="처리 중" tone="danger" />
              </form>
            </section>
          )}

          {payment.status === "REFUND_REQUESTED" && pendingRefund && (
            <section className="rounded-xl border border-orange-200 bg-white p-5">
              <h3 className="text-lg font-black text-slate-950">환불 요청 처리</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">실제 계좌 환불을 완료한 뒤 환불 완료를 선택하세요. 이용권 지급도 함께 회수됩니다.</p>
              <form action={resolveRefundAction} className="mt-4 grid gap-4">
                <input type="hidden" name="paymentRequestId" value={payment.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <Field label="처리 유형">
                  <select name="resolution" required className={inputClass} defaultValue="COMPLETED">
                    <option value="COMPLETED">실제 환불 완료</option>
                    <option value="REJECTED">환불 요청 반려</option>
                  </select>
                </Field>
                <Field label="처리 메모"><textarea name="adminMemo" required maxLength={2000} rows={3} className={inputClass} /></Field>
                <SubmitButton label="환불 상태 반영" pendingLabel="처리 중" tone="danger" />
              </form>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-black text-slate-950">관리자 메모</h3>
            <form action={updatePaymentMemoAction} className="mt-4 grid gap-4">
              <input type="hidden" name="paymentRequestId" value={payment.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="sr-only" htmlFor="payment-admin-memo">관리자 메모</label>
              <textarea id="payment-admin-memo" name="adminMemo" maxLength={2000} rows={5} defaultValue={payment.adminMemo ?? ""} className={inputClass} />
              <SubmitButton label="메모 저장" pendingLabel="저장 중" tone="secondary" />
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}

const inputClass = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-bold text-slate-700">{label}{children}</label>;
}

function Summary({ label, value, detail, mono = false }: { label: string; value: string; detail: string; mono?: boolean }) {
  return <div className="min-w-0 min-h-28 bg-white p-4"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className={`mt-2 break-words text-lg font-black text-slate-950 ${mono ? "font-mono" : ""}`}>{value}</dd><p className="mt-1 break-all text-xs text-slate-500">{detail}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-slate-900">{value}</dd></div>;
}

function Memo({ label, value }: { label: string; value: string | null }) {
  return <div className="min-w-0"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{value || "없음"}</p></div>;
}

function formatKrw(value: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function todayInSeoul(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatPaymentAuditAction(action: string): string {
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
