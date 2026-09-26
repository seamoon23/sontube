import { FlashMessage } from "@/components/superadmin/flash-message";
import { ActiveStatusBadge } from "@/components/superadmin/status-badge";
import { SubmitButton } from "@/components/superadmin/submit-button";
import {
  createPaymentPlanAction,
  togglePaymentPlanActiveAction,
  updatePaymentPlanAction,
} from "@/app/superadmin/actions";
import { prisma } from "@/lib/db";
import { requireSuperAdminSession } from "@/lib/superadmin-session";

export const dynamic = "force-dynamic";

type PlansPageProps = {
  searchParams: Promise<{ notice?: string; error?: string }>;
};

export default async function SuperAdminPlansPage({ searchParams }: PlansPageProps) {
  await requireSuperAdminSession();
  const params = await searchParams;
  const plans = await prisma.paymentPlan.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { requests: true } } },
  });

  return (
    <div className="grid gap-6">
      <FlashMessage notice={params.notice} error={params.error} />

      <div>
        <p className="text-sm font-extrabold text-teal-700">요금제</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">수동 결제 상품 관리</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          부모 화면에는 활성 요금제만 표시됩니다. 기존 신청은 신청 당시의 금액과 기간 사본을 유지합니다.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
        <h3 className="text-lg font-black text-slate-950">새 요금제</h3>
        <form action={createPaymentPlanAction} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <input type="hidden" name="returnTo" value="/superadmin/plans" />
          <Field label="코드"><input name="code" required minLength={2} maxLength={40} className={inputClass} placeholder="ANNUAL_2026" /></Field>
          <Field label="이름"><input name="name" required maxLength={80} className={inputClass} placeholder="연간 이용권" /></Field>
          <Field label="가격(원)"><input name="priceKrw" type="number" required min={1} max={100000000} className={inputClass} /></Field>
          <Field label="이용기간(일)"><input name="durationDays" type="number" required min={1} max={3650} className={inputClass} /></Field>
          <Field label="표시 순서"><input name="displayOrder" type="number" required min={-10000} max={10000} defaultValue={0} className={inputClass} /></Field>
          <label className="flex min-h-11 items-center gap-3 self-end rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <input name="isActive" type="checkbox" className="h-4 w-4 accent-teal-700" />
            생성 즉시 활성
          </label>
          <Field label="설명" className="md:col-span-2 xl:col-span-5"><textarea name="description" maxLength={500} rows={2} className={inputClass} placeholder="부모 화면에 표시할 짧은 설명" /></Field>
          <div className="flex items-end"><SubmitButton label="요금제 만들기" pendingLabel="생성 중" className="w-full" /></div>
        </form>
      </section>

      <section className="grid gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-950">등록된 요금제</h3>
          <p className="mt-1 text-sm text-slate-500">{plans.length}개</p>
        </div>

        {plans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-500">아직 만든 요금제가 없습니다.</div>
        ) : (
          plans.map((plan) => (
            <article key={plan.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="min-w-0 break-words text-xl font-black text-slate-950">{plan.name}</h4>
                    <ActiveStatusBadge active={plan.isActive} />
                  </div>
                  <p className="mt-1 break-all font-mono text-xs font-bold text-slate-500">{plan.code}</p>
                  <p className="mt-3 break-words text-sm leading-6 text-slate-600">{plan.description || "설명 없음"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-2xl font-black text-slate-950">{formatKrw(plan.priceKrw)}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{plan.durationDays}일 / 신청 {plan._count.requests}건</p>
                </div>
              </div>

              <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-teal-800">요금제 수정과 활성 상태</summary>
                <form action={updatePaymentPlanAction} className="mt-4 grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-2 xl:grid-cols-6">
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="returnTo" value="/superadmin/plans" />
                  <Field label="코드"><input name="code" required minLength={2} maxLength={40} defaultValue={plan.code} className={inputClass} /></Field>
                  <Field label="이름"><input name="name" required maxLength={80} defaultValue={plan.name} className={inputClass} /></Field>
                  <Field label="가격(원)"><input name="priceKrw" type="number" required min={1} max={100000000} defaultValue={plan.priceKrw} className={inputClass} /></Field>
                  <Field label="이용기간(일)"><input name="durationDays" type="number" required min={1} max={3650} defaultValue={plan.durationDays} className={inputClass} /></Field>
                  <Field label="표시 순서"><input name="displayOrder" type="number" required min={-10000} max={10000} defaultValue={plan.displayOrder} className={inputClass} /></Field>
                  <div className="flex items-end"><SubmitButton label="내용 저장" pendingLabel="저장 중" className="w-full" /></div>
                  <Field label="설명" className="md:col-span-2 xl:col-span-6"><textarea name="description" maxLength={500} rows={2} defaultValue={plan.description ?? ""} className={inputClass} /></Field>
                </form>
                <form action={togglePaymentPlanActiveAction} className="mt-4 flex justify-end border-t border-slate-200 pt-4">
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="returnTo" value="/superadmin/plans" />
                  <SubmitButton label={plan.isActive ? "요금제 비활성화" : "요금제 활성화"} pendingLabel="변경 중" tone={plan.isActive ? "danger" : "secondary"} />
                </form>
              </details>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

const inputClass = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-2 text-sm font-bold text-slate-700 ${className}`}>{label}{children}</label>;
}

function formatKrw(value: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}
