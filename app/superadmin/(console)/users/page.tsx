import { FlashMessage } from "@/components/superadmin/flash-message";
import { ActiveStatusBadge } from "@/components/superadmin/status-badge";
import { SubmitButton } from "@/components/superadmin/submit-button";
import {
  createFamilyAction,
  createParentUserAction,
  resetParentPasswordAction,
  startImpersonationAction,
  toggleFamilyActiveAction,
  toggleParentUserActiveAction,
} from "@/app/superadmin/actions";
import { prisma } from "@/lib/db";
import { requireSuperAdminSession } from "@/lib/superadmin-session";

export const dynamic = "force-dynamic";

type UsersPageProps = {
  searchParams: Promise<{ q?: string; notice?: string; error?: string }>;
};

export default async function SuperAdminUsersPage({ searchParams }: UsersPageProps) {
  await requireSuperAdminSession();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const returnTo = q ? `/superadmin/users?q=${encodeURIComponent(q)}` : "/superadmin/users";
  const families = await prisma.family.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { users: { some: { OR: [{ email: { contains: q } }, { displayName: { contains: q } }] } } },
          ],
        }
      : undefined,
    take: 100,
    orderBy: { updatedAt: "desc" },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      subscription: true,
      _count: { select: { videos: true, appAccessKeys: true, paymentRequests: true } },
    },
  });

  return (
    <div className="grid gap-6">
      <FlashMessage notice={params.notice} error={params.error} />

      <div>
        <p className="text-sm font-extrabold text-teal-700">사용자·가족</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">계정과 가족 접근 관리</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          가족 활성 상태가 꺼지면 소속 보호자는 로그인할 수 없습니다. 대체 로그인은 사유와 비밀번호 재확인이 필요합니다.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
        <h3 className="text-lg font-black text-slate-950">새 가족과 대표 보호자</h3>
        <form action={createFamilyAction} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="returnTo" value={returnTo} />
          <Field label="가족 이름">
            <input name="familyName" required maxLength={80} className={inputClass} placeholder="예: 김가족 영상서랍" />
          </Field>
          <Field label="보호자 이름">
            <input name="displayName" required maxLength={80} className={inputClass} placeholder="예: 김보호" />
          </Field>
          <Field label="보호자 이메일">
            <input name="email" type="email" required maxLength={320} autoComplete="off" className={inputClass} placeholder="parent@example.com" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2">
            <Field label="임시 비밀번호">
              <input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className={inputClass} />
            </Field>
            <Field label="비밀번호 확인">
              <input name="passwordConfirmation" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className={inputClass} />
            </Field>
          </div>
          <div className="flex items-end xl:col-span-2 xl:justify-end">
            <SubmitButton label="가족과 계정 만들기" pendingLabel="생성 중" className="w-full xl:w-auto" />
          </div>
        </form>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-950">등록된 가족</h3>
            <p className="mt-1 text-sm text-slate-500">최대 100개까지 표시합니다.</p>
          </div>
          <form className="flex w-full gap-2 sm:w-auto">
            <label className="sr-only" htmlFor="family-search">가족 또는 보호자 검색</label>
            <input id="family-search" name="q" defaultValue={q} className={`${inputClass} min-w-0 flex-1 sm:w-72`} placeholder="이름 또는 이메일 검색" />
            <button className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:border-teal-600 hover:text-teal-800">검색</button>
          </form>
        </div>

        {families.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-500">
            {q ? "검색 조건에 맞는 가족이 없습니다." : "아직 등록된 가족이 없습니다."}
          </div>
        ) : (
          families.map((family) => {
            const subscriptionActive = Boolean(
              family.subscription && family.subscription.status === "ACTIVE" && family.subscription.expiresAt > new Date(),
            );

            return (
              <article key={family.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="grid gap-4 border-b border-slate-200 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="min-w-0 break-words text-xl font-black text-slate-950">{family.name}</h4>
                      <ActiveStatusBadge active={family.isActive} />
                      <span className={`rounded-md border px-2 py-1 text-xs font-bold ${subscriptionActive ? "border-teal-200 bg-teal-50 text-teal-900" : "border-slate-300 bg-slate-100 text-slate-600"}`}>
                        {subscriptionActive ? "이용권 활성" : "이용권 없음"}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                      <Count label="보호자" value={family.users.length} />
                      <Count label="영상" value={family._count.videos} />
                      <Count label="앱 키" value={family._count.appAccessKeys} />
                      <Count label="결제 신청" value={family._count.paymentRequests} />
                    </dl>
                    <p className="mt-3 text-xs text-slate-500">
                      이용권 만료: {family.subscription ? formatDateTime(family.subscription.expiresAt) : "없음"}
                    </p>
                  </div>
                  <form action={toggleFamilyActiveAction}>
                    <input type="hidden" name="familyId" value={family.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <SubmitButton
                      label={family.isActive ? "가족 비활성화" : "가족 활성화"}
                      pendingLabel="변경 중"
                      tone={family.isActive ? "danger" : "secondary"}
                    />
                  </form>
                </div>

                <div className="grid gap-3 p-5">
                  {family.users.map((user) => (
                    <div key={user.id} className="grid gap-4 rounded-xl bg-slate-50 p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words font-bold text-slate-950">{user.displayName}</p>
                          <ActiveStatusBadge active={user.isActive} />
                        </div>
                        <p className="mt-1 break-all text-sm text-slate-600">{user.email}</p>
                        <p className="mt-1 text-xs text-slate-500">최근 로그인: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "없음"}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3 xl:w-[620px]">
                        <form action={toggleParentUserActiveAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <SubmitButton label={user.isActive ? "계정 비활성화" : "계정 활성화"} pendingLabel="변경 중" tone="secondary" className="w-full" />
                        </form>
                        <details className="rounded-lg border border-slate-300 bg-white px-3 py-2 open:sm:col-span-3">
                          <summary className="flex min-h-11 cursor-pointer items-center justify-center py-1 text-center text-sm font-bold text-slate-700">비밀번호 재설정</summary>
                          <form action={resetParentPasswordAction} className="mt-3 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
                            <input type="hidden" name="userId" value={user.id} />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <Field label="새 비밀번호">
                              <input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className={inputClass} />
                            </Field>
                            <Field label="비밀번호 확인">
                              <input name="passwordConfirmation" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className={inputClass} />
                            </Field>
                            <SubmitButton label="비밀번호 저장" pendingLabel="저장 중" className="sm:col-span-2" />
                          </form>
                        </details>
                        <details className="rounded-lg border border-teal-300 bg-white px-3 py-2 open:sm:col-span-3">
                          <summary className="flex min-h-11 cursor-pointer items-center justify-center py-1 text-center text-sm font-bold text-teal-800">대체 로그인</summary>
                          {family.isActive && user.isActive ? (
                            <form action={startImpersonationAction} className="mt-3 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
                              <input type="hidden" name="userId" value={user.id} />
                              <input type="hidden" name="returnTo" value={returnTo} />
                              <Field label="최종관리자 비밀번호">
                                <input name="superadminPassword" type="password" required maxLength={256} autoComplete="current-password" className={inputClass} />
                              </Field>
                              <Field label="확인 사유">
                                <input name="reason" required minLength={5} maxLength={500} className={inputClass} placeholder="예: 목록 저장 오류 재현" />
                              </Field>
                              <p className="text-xs leading-5 text-slate-500 sm:col-span-2">30분 동안 이 보호자 화면으로 이동합니다. 시작 기록과 사유가 감사 로그에 남습니다.</p>
                              <SubmitButton label="30분 대체 로그인 시작" pendingLabel="확인 중" className="sm:col-span-2" />
                            </form>
                          ) : (
                            <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">가족과 보호자 계정을 먼저 활성화하세요.</p>
                          )}
                        </details>
                      </div>
                    </div>
                  ))}

                  <details className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-teal-800">이 가족에 보호자 추가</summary>
                    <form action={createParentUserAction} className="mt-4 grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-2 xl:grid-cols-4">
                      <input type="hidden" name="familyId" value={family.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <Field label="보호자 이름"><input name="displayName" required maxLength={80} className={inputClass} /></Field>
                      <Field label="보호자 이메일"><input name="email" type="email" required maxLength={320} autoComplete="off" className={inputClass} /></Field>
                      <Field label="임시 비밀번호"><input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className={inputClass} /></Field>
                      <Field label="비밀번호 확인"><input name="passwordConfirmation" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className={inputClass} /></Field>
                      <SubmitButton label="보호자 추가" pendingLabel="추가 중" className="md:col-span-2 xl:col-span-4" />
                    </form>
                  </details>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

const inputClass = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-bold text-slate-700">{label}{children}</label>;
}

function Count({ label, value }: { label: string; value: number }) {
  return <div><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 font-mono text-lg font-black text-slate-900">{value}</dd></div>;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
