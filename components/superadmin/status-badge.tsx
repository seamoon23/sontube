const paymentClasses: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-900",
  CONFIRMED: "border-teal-200 bg-teal-50 text-teal-900",
  REJECTED: "border-red-200 bg-red-50 text-red-800",
  EXPIRED: "border-slate-300 bg-slate-100 text-slate-700",
  REFUND_REQUESTED: "border-orange-200 bg-orange-50 text-orange-900",
  REFUNDED: "border-sky-200 bg-sky-50 text-sky-900",
  PARTIAL_REFUNDED: "border-sky-200 bg-sky-50 text-sky-900",
};

const paymentLabels: Record<string, string> = {
  PENDING: "입금 확인 대기",
  CONFIRMED: "입금 확인 완료",
  REJECTED: "확인 불가",
  EXPIRED: "신청 만료",
  REFUND_REQUESTED: "환불 처리 대기",
  REFUNDED: "환불 완료",
  PARTIAL_REFUNDED: "일부 환불 완료",
};

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-bold ${paymentClasses[status] ?? paymentClasses.EXPIRED}`}>
      {paymentLabels[status] ?? status}
    </span>
  );
}

export function ActiveStatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-bold ${
      active
        ? "border-teal-200 bg-teal-50 text-teal-900"
        : "border-slate-300 bg-slate-100 text-slate-700"
    }`}>
      {active ? "활성" : "비활성"}
    </span>
  );
}
