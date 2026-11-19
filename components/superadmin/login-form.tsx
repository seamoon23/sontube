"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  loginSuperAdminAction,
  type SuperAdminLoginResult,
} from "@/app/superadmin/actions";

export function SuperAdminLoginForm({ setupRequired }: { setupRequired: boolean }) {
  const [result, setResult] = useState<SuperAdminLoginResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const loginIdRef = useRef<HTMLInputElement>(null);
  const hasError = Boolean(result && !result.ok);

  useEffect(() => {
    if (hasError) loginIdRef.current?.focus();
  }, [hasError]);

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      setResult(await loginSuperAdminAction(formData));
    });
  }

  return (
    <form
      action={submit}
      className="mx-auto grid w-full max-w-md gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-soft md:p-7"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-extrabold text-teal-700">SonTube Operations</p>
          <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-bold text-teal-800">
            최종관리자 전용
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">운영 콘솔 로그인</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          가족 계정, 무료 영상 한도와 과거 결제 기록을 다루는 별도 보호 구역입니다.
        </p>
      </div>

      {setupRequired ? (
        <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-bold">최종관리자 환경설정이 필요합니다.</p>
          <p>시작 위치: <code>C:\codex\app\sontube</code>의 PowerShell</p>
          <code
            tabIndex={0}
            className="block max-w-full overflow-x-auto whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-50"
          >
            npm run auth:hash -- &lt;최종관리자비밀번호&gt; &lt;SUPERADMIN_SESSION_SECRET&gt;
          </code>
          <p>
            생성된 해시와 별도 비밀값을 <code>.env</code>의 아래 세 항목에 설정한 뒤 서버를 다시 시작하세요.
          </p>
          <ul className="grid gap-1 font-mono text-xs">
            <li>SUPERADMIN_LOGIN_ID</li>
            <li>SUPERADMIN_PASSWORD_HASH</li>
            <li>SUPERADMIN_SESSION_SECRET</li>
          </ul>
        </div>
      ) : (
        <>
          <label className="grid gap-2 text-sm font-bold text-slate-800">
            로그인 ID
            <input
              ref={loginIdRef}
              name="loginId"
              autoComplete="username"
              required
              aria-invalid={hasError || undefined}
              aria-describedby={hasError ? "superadmin-login-error" : undefined}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-800">
            비밀번호
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={hasError || undefined}
              aria-describedby={hasError ? "superadmin-login-error" : undefined}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </label>

          {result && !result.ok && (
            <p
              id="superadmin-login-error"
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
            >
              {result.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="min-h-12 rounded-lg bg-teal-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-900 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "확인 중" : "최종관리자로 로그인"}
          </button>
        </>
      )}

      <p className="text-xs leading-5 text-slate-500">
        보호자 계정과 세션이 분리되어 있습니다. 이 주소와 로그인 정보를 다른 사용자에게 공유하지 마세요.
      </p>
    </form>
  );
}
