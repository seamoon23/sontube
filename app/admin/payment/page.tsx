import { PaymentRefundForm, PaymentRequestForm } from "@/components/admin/payment-request-form";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";
import { getManualPaymentStatusLabel, type ManualPaymentStatus } from "@/lib/manual-payment";
import { getManualPaymentConfig } from "@/lib/payment-config";

export const dynamic = "force-dynamic";

export default async function AdminPaymentPage() {
  const session = await requireAdminSession();
  const config = getManualPaymentConfig();
  const [plans, requests, subscription] = await Promise.all([
    prisma.paymentPlan.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { priceKrw: "asc" }],
    }),
    prisma.paymentRequest.findMany({
      where: { familyId: session.familyId },
      include: { grant: true, refunds: { orderBy: { requestedAt: "desc" } } },
      orderBy: { requestedAt: "desc" },
      take: 50,
    }),
    prisma.familySubscription.findUnique({ where: { familyId: session.familyId } }),
  ]);
  const isImpersonating = Boolean(session.impersonatedBy);
  const canApply = config.isConfigured && !isImpersonating;

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold text-ocean">이용권·결제</p>
        <h1 className="text-2xl font-bold text-ink">계좌이체 이용권</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          SonTube는 현재 선불 계좌이체로 운영합니다. 자동결제와 자동갱신은 없으며, 입금 확인 후 운영자가 직접 이용권을 활성화합니다.
        </p>
      </div>

      {isImpersonating && (
        <div className="rounded-lg border border-purple-300 bg-purple-50 p-4 text-sm font-semibold text-purple-900">
          최종관리자 대체 로그인 중에는 결제 신청, 환불 요청과 계정 보안 변경을 할 수 없습니다.
        </div>
      )}

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs font-bold text-ocean">현재 이용 상태</p>
          <h2 className="mt-1 text-xl font-bold text-ink">{getSubscriptionLabel(subscription)}</h2>
          {subscription && (
            <p className="mt-1 text-sm text-slate-600">{formatDate(subscription.startsAt)} ~ {formatDate(subscription.expiresAt)}</p>
          )}
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">자동갱신 없음</span>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {plans.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 md:col-span-2">
            현재 신청 가능한 이용권이 없습니다. 운영자가 가격과 상품을 준비한 뒤 표시됩니다.
          </div>
        ) : (
          plans.map((plan) => (
            <article key={plan.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-ocean">{plan.code}</p>
              <h2 className="mt-1 text-xl font-bold text-ink">{plan.name}</h2>
              <p className="mt-2 text-3xl font-black text-ink">{formatKrw(plan.priceKrw)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">{plan.durationDays}일 · 입금 확인 후 시작</p>
              {plan.description && <p className="mt-3 text-sm leading-6 text-slate-600">{plan.description}</p>}
              <p className="mt-3 text-xs text-slate-500">활성 이용권이 있으면 현재 만료일 다음 날부터 이어서 연장됩니다.</p>
            </article>
          ))
        )}
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-sky-50 p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold text-ocean">입금 계좌</p>
          <h2 className="mt-1 text-lg font-bold text-ink">신청 정보와 같은 입금자명으로 보내주세요</h2>
        </div>
        {config.isConfigured ? (
          <dl className="grid gap-3 rounded-md bg-white p-4 text-sm sm:grid-cols-2">
            <Info label="은행" value={config.bankName} />
            <Info label="계좌번호" value={config.accountNumber} />
            <Info label="예금주" value={config.accountHolder} />
            <Info label="사업자" value={`${config.businessName} · ${config.businessNumber}`} />
          </dl>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            계좌이체 안내를 준비 중입니다. 계좌정보가 설정되기 전에는 입금 확인 요청을 받지 않습니다.
          </div>
        )}
        <p className="text-sm leading-6 text-slate-700">{config.confirmationNotice}</p>
        <p className="text-sm leading-6 text-slate-700">문의: {config.supportContact || "준비 중"}</p>
      </section>

      <PaymentRequestForm
        plans={plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          description: plan.description,
          priceKrw: plan.priceKrw,
          durationDays: plan.durationDays,
        }))}
        disabled={!canApply}
      />

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold text-ocean">결제 내역</p>
          <h2 className="mt-1 text-lg font-bold text-ink">입금 확인 처리 상태</h2>
        </div>
        {requests.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-5 text-center text-sm text-slate-500">아직 결제 신청 내역이 없습니다.</p>
        ) : (
          <div className="grid gap-3">
            {requests.map((request) => (
              <article key={request.id} className="grid gap-3 rounded-md border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-bold text-slate-500">{request.requestNo}</p>
                    <h3 className="mt-1 font-bold text-ink">{request.planNameSnapshot}</h3>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-xs font-bold ${statusClassName(request.status)}`}>
                    {getManualPaymentStatusLabel(request.status as ManualPaymentStatus)}
                  </span>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="신청금액" value={formatKrw(request.amountKrw)} />
                  <Info label="입금자명" value={request.depositorName} />
                  <Info label="신청일" value={formatDateTime(request.requestedAt)} />
                  <Info label="입금 예정일" value={request.expectedDepositDate || "미입력"} />
                  {request.confirmedAt && <Info label="확인일" value={formatDateTime(request.confirmedAt)} />}
                  {request.grant && <Info label="이용 시작" value={formatDate(request.grant.startsAt)} />}
                  {request.grant && <Info label="이용 만료" value={formatDate(request.grant.expiresAt)} />}
                </dl>
                {request.status === "REJECTED" && (
                  <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">입금 정보를 확인하지 못했습니다. 신청번호와 함께 고객지원으로 문의해 주세요.</p>
                )}
                {request.status === "CONFIRMED" && !isImpersonating && (
                  <PaymentRefundForm paymentRequestId={request.id} />
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-2 rounded-lg border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
        <h2 className="text-lg font-bold text-ink">환불·현금영수증 안내</h2>
        <p>{config.refundPolicy}</p>
        <p>현금영수증이 필요하면 신청번호와 함께 고객지원으로 문의해 주세요. 휴대전화번호나 사업자번호 같은 발급정보는 이 화면에서 수집하지 않습니다.</p>
        <p>실제 송금 전에 상태를 환불 완료로 바꾸지 않으며, 처리 결과는 위 결제 내역에 표시됩니다.</p>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-800">{value}</dd></div>;
}

function getSubscriptionLabel(subscription: { status: string; expiresAt: Date } | null): string {
  if (!subscription) return "활성 이용권 없음";
  if (subscription.status === "ACTIVE" && subscription.expiresAt > new Date()) return `${formatDate(subscription.expiresAt)}까지 이용 가능`;
  if (subscription.status === "SUSPENDED") return "이용 일시 중지";
  return "이용 기간 종료";
}

function formatKrw(value: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(value);
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(value);
}

function statusClassName(status: string): string {
  if (status === "CONFIRMED") return "bg-green-100 text-green-800";
  if (status === "PENDING") return "bg-amber-100 text-amber-800";
  if (status === "REFUND_REQUESTED") return "bg-purple-100 text-purple-800";
  if (status === "REFUNDED") return "bg-slate-200 text-slate-700";
  return "bg-red-100 text-red-800";
}