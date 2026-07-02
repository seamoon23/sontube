"use client";

import { useState, useTransition } from "react";
import { loginAdminAction, type LoginResult } from "@/app/admin/login/actions";

export function LoginForm({ setupRequired }: { setupRequired: boolean }) {
  const [result, setResult] = useState<LoginResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      setResult(await loginAdminAction(formData));
    });
  }

  return (
    <form action={submit} className="mx-auto grid max-w-md gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-ocean">SonTube Admin</p>
        <h2 className="mt-1 text-2xl font-bold text-ink">관리자 로그인</h2>
      </div>

      {setupRequired && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          `.env`에 `ADMIN_PASSWORD_HASH`와 `SESSION_SECRET`을 설정해야 관리자 화면에 들어갈 수 있습니다.
        </div>
      )}

      <label className="grid gap-2 text-sm font-semibold text-slate-800">
        비밀번호
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
          required
        />
      </label>

      {result && !result.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{result.message}</p>
      )}

      <button
        type="submit"
        disabled={isPending || setupRequired}
        className="rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "확인 중" : "로그인"}
      </button>
    </form>
  );
}
