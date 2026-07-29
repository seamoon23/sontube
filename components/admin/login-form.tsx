"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { loginAdminAction, type LoginResult } from "@/app/admin/login/actions";

export function LoginForm({ setupRequired }: { setupRequired: boolean }) {
  const [result, setResult] = useState<LoginResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const passwordRef = useRef<HTMLInputElement>(null);
  const hasError = Boolean(result && !result.ok);

  useEffect(() => {
    if (hasError) passwordRef.current?.focus();
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
        <p className="text-sm font-semibold text-ocean">SonTube Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">관리자 로그인</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          아이디 없이, 이 서버에 직접 설정한 관리자 비밀번호로 로그인합니다.
        </p>
      </div>

      {setupRequired && (
        <div id="admin-setup-message" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <code>.env</code>에 <code>ADMIN_PASSWORD_HASH</code>와 <code>SESSION_SECRET</code>을 설정해야 관리자
          화면에 들어갈 수 있습니다.
        </div>
      )}

      {!setupRequired && (
        <>
          <label className="grid gap-2 text-sm font-semibold text-slate-800">
            비밀번호
            <input
              ref={passwordRef}
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
            <p
              id="admin-login-error"
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {result.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "확인 중" : "로그인"}
          </button>
        </>
      )}

      <details
        open={setupRequired ? true : undefined}
        className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
      >
        <summary className="cursor-pointer font-semibold text-ink">비밀번호를 처음 만들거나 잊었나요?</summary>
        <div className="mt-3 grid gap-3 leading-6">
          <p>기본 비밀번호는 없습니다. 아래 경로의 PowerShell에서 새 비밀번호 해시를 만든 뒤 서버를 다시 시작하세요.</p>
          <code className="overflow-x-auto rounded-md bg-slate-900 px-3 py-2 text-xs text-white">
            cd C:\codex\app\sontube
          </code>
          <code className="overflow-x-auto rounded-md bg-slate-900 px-3 py-2 text-xs text-white">
            npm run auth:hash -- &lt;새비밀번호&gt; &lt;새세션비밀키&gt;
          </code>
          <p>
            출력된 해시를 <code>.env</code>의 <code>ADMIN_PASSWORD_HASH</code>에 넣고, 같은 새 세션 비밀키를{" "}
            <code>SESSION_SECRET</code>에 넣습니다.
          </p>
        </div>
      </details>
    </form>
  );
}
