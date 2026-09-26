"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createPaymentRequestAction,
  requestPaymentRefundAction,
  type PaymentActionResult,
} from "@/app/admin/payment/actions";

export type PaymentPlanOption = {
  id: string;
  name: string;
  description: string | null;
  priceKrw: number;
  durationDays: number;
};

export function PaymentRequestForm({
  plans,
  disabled,
}: {
  plans: PaymentPlanOption[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<PaymentActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const next = await createPaymentRequestAction(formData);
      setResult(next);
      if (next.ok) router.refresh();
    });
  }

  return (
    <form
      action={submit}
      aria-busy={isPending}
      className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div>
        <p className="text-xs font-bold text-ocean">입금 완료 신청</p>
        <h2 className="mt-1 text-lg font-bold text-ink">입금 정보를 알려주세요</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">신청만으로 이용권이 열리지 않으며, 운영자가 실제 입금을 확인한 뒤 활성화합니다.</p>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        이용권
        <select name="planId" required disabled={disabled || isPending} className="min-h-11 rounded-md border border-slate-300 px-3 py-3 text-sm">
          <option value="">선택해 주세요</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.name} · {formatKrw(plan.priceKrw)} · {plan.durationDays}일</option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          입금자명
          <input name="depositorName" maxLength={40} required disabled={disabled || isPending} placeholder="통장에 표시되는 이름" className="min-h-11 rounded-md border border-slate-300 px-3 py-3 text-sm" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          입금일 또는 예정일
          <input name="expectedDepositDate" type="date" required disabled={disabled || isPending} className="min-h-11 rounded-md border border-slate-300 px-3 py-3 text-sm" />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        전달 메모 <span className="font-normal text-slate-500">(선택)</span>
        <textarea name="userMemo" maxLength={1000} rows={3} disabled={disabled || isPending} className="rounded-md border border-slate-300 px-3 py-3 text-sm" />
      </label>
      {result && (
        <p role={result.ok ? "status" : "alert"} aria-live={result.ok ? "polite" : "assertive"} aria-atomic="true" className={`rounded-md border px-4 py-3 text-sm font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {result.message}
        </p>
      )}
      <button type="submit" disabled={disabled || isPending || plans.length === 0} className="min-h-11 rounded-md bg-ink px-4 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
        {isPending ? "접수 중" : "입금 확인 요청"}
      </button>
    </form>
  );
}

export function PaymentRefundForm({ paymentRequestId }: { paymentRequestId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<PaymentActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    if (!window.confirm("전액 환불 요청을 접수할까요? 실제 환불은 운영자 확인 후 처리됩니다.")) return;
    startTransition(async () => {
      const next = await requestPaymentRefundAction(paymentRequestId, formData);
      setResult(next);
      if (next.ok) router.refresh();
    });
  }

  return (
    <form action={submit} aria-busy={isPending} className="grid gap-2 border-t border-slate-100 pt-3">
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        환불 사유 (선택)
        <input name="reason" maxLength={1000} className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={isPending} className="min-h-11 justify-self-start rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-red-300 hover:text-red-700 disabled:opacity-50">
        {isPending ? "요청 중" : "전액 환불 요청"}
      </button>
      {result && <p role={result.ok ? "status" : "alert"} aria-live={result.ok ? "polite" : "assertive"} aria-atomic="true" className={`text-xs font-semibold ${result.ok ? "text-green-700" : "text-red-700"}`}>{result.message}</p>}
    </form>
  );
}

function formatKrw(value: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}
