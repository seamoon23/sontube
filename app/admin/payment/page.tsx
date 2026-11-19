import { PaymentRefundForm } from "@/components/admin/payment-request-form";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/db";
import { getManualPaymentStatusLabel, type ManualPaymentStatus } from "@/lib/manual-payment";
import { getManualPaymentConfig } from "@/lib/payment-config";

export const dynamic = "force-dynamic";

export default async function AdminPaymentPage() {
  const session = await requireAdminSession();
  const config = getManualPaymentConfig();
  const requests = await prisma.paymentRequest.findMany({
    where: { familyId: session.familyId },
    include: { grant: true, refunds: { orderBy: { requestedAt: "desc" } } },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });
  const isImpersonating = Boolean(session.impersonatedBy);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-2xl font-bold text-ink">무료 이용 안내</h2>
        <p className="text-sm leading-6 text-slate-600">SonTube는 개인 개발자가 운영하는 가족용 영상 관리 앱입니다. 기본 한도는 가족당 영상 20개이며 운영자가 무료로 승인한 가족은 한도가 다를 수 있습니다.</p>
        <p className="text-sm leading-6 text-slate-600">기간 제한이나 결제는 없습니다. 한도에 도달해도 기존 영상은 계속 관리하고 시청할 수 있습니다. 현재 한도와 등록 수는 대시보드에서 확인하세요.</p>
      </section>

      {requests.length > 0 && <>
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
                  <div className="min-w-0">
                    <p className="break-all font-mono text-xs font-bold text-slate-500">{request.requestNo}</p>
                    <h3 className="mt-1 break-words font-bold text-ink">{request.planNameSnapshot}</h3>
                  </div>
                  <span className={`shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ${statusClassName(request.status)}`}>
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
      </>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-800">{value}</dd></div>;
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
