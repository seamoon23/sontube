"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { loginAdminAction, type LoginResult } from "@/app/admin/login/actions";

export function LoginForm({ setupRequired }: { setupRequired: boolean }) {
  const [result, setResult] = useState<LoginResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);
  const hasError = Boolean(result && !result.ok);

  useEffect(() => {
    if (hasError) emailRef.current?.focus();
  }, [hasError]);

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      setResult(await loginAdminAction(formData));
    });
  }

  return (
    <form action={submit} className="mx-auto grid w-full max-w-md gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-ocean">SonTube Parent</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">보호자 로그인</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          등록된 보호자 이메일과 비밀번호로 가족 영상서랍을 관리합니다.
        </p>
      </div>

      {setupRequired ? (
        <div id="admin-setup-message" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          보호자 계정 준비가 필요합니다. 프로젝트 루트의 <code>.env</code>를 설정한 뒤 <code>npm run db:seed</code>를 실행하세요.
        </div>
      ) : (
        <>
          <label className="grid gap-2 text-sm font-semibold text-slate-800">
            이메일
            <input
              ref={emailRef}
              name="email"
              type="email"
              autoComplete="username"
              aria-invalid={hasError || undefined}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-800">
            비밀번호
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={hasError || undefined}
              aria-describedby={hasError ? "admin-login-error" : undefined}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
              required
            />
          </label>

          {result && !result.ok && (
            <p id="admin-login-error" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {result.message}
            </p>
          )}

          <button type="submit" disabled={isPending} className="rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
            {isPending ? "확인 중" : "로그인"}
          </button>
        </>
      )}

      <details open={setupRequired ? true : undefined} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <summary className="cursor-pointer font-semibold text-ink">최초 보호자 계정 준비 방법</summary>
        <div className="mt-3 grid gap-3 leading-6">
          <p>시작 위치: <code>C:\codex\app\sontube</code>의 PowerShell.</p>
          <p><code>SESSION_SECRET</code>, <code>ADMIN_PASSWORD_HASH</code>, <code>PARENT_BOOTSTRAP_EMAIL</code>을 <code>.env</code>에 설정합니다.</p>
          <code className="overflow-x-auto rounded-md bg-slate-900 px-3 py-2 text-xs text-white">npm run auth:hash -- &lt;새비밀번호&gt; &lt;SESSION_SECRET&gt;</code>
          <code className="overflow-x-auto rounded-md bg-slate-900 px-3 py-2 text-xs text-white">npm run db:seed</code>
        </div>
      </details>
    </form>
  );
}