"use client";

import { useEffect, useState } from "react";
import { endImpersonationAction } from "@/app/superadmin/actions";

type AdminContext = {
  ok: true;
  displayName: string;
  impersonatedBy: string | null;
};

export function ImpersonationBanner() {
  const [context, setContext] = useState<AdminContext | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/context", { cache: "no-store", signal: controller.signal })
      .then(async (response) => (response.ok ? ((await response.json()) as AdminContext) : null))
      .then((value) => setContext(value?.ok ? value : null))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (!context?.impersonatedBy) return null;

  return (
    <aside className="sticky top-0 z-50 border-b border-purple-300 bg-purple-100 px-4 py-3 text-purple-950 shadow-sm" role="status">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold">
          최종관리자 <span className="font-mono">{context.impersonatedBy}</span>가 {context.displayName} 보호자 화면을 대체 로그인으로 확인 중입니다. 결제·환불·계정 보안 변경은 차단됩니다.
        </p>
        <form action={endImpersonationAction}>
          <button className="rounded-md border border-purple-400 bg-white px-3 py-2 text-xs font-black text-purple-900 hover:bg-purple-50">
            대체 로그인 종료
          </button>
        </form>
      </div>
    </aside>
  );
}