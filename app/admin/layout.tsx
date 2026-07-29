"use client";

import { usePathname } from "next/navigation";
import { AdminAdSlot } from "@/components/admin/admin-ad-slot";
import { AdminNav } from "@/components/admin/admin-nav";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <div className="grid min-h-dvh content-start bg-slate-50 px-4 py-6 sm:content-center sm:py-10">{children}</div>;
  }

  return (
    <div id="admin-shell" className="min-h-screen bg-slate-50">
      <a
        href="#admin-main"
        className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-md bg-white px-4 py-3 font-semibold text-ink shadow-lg focus:translate-y-0"
      >
        본문으로 건너뛰기
      </a>
      <header id="admin-header" className="border-b border-slate-200 bg-ink px-4 py-5 text-white md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-sky-200">SonTube Admin</p>
            <h1 className="text-2xl font-bold">보호자 영상 관리</h1>
          </div>
        </div>
      </header>
      <AdminNav />
      <main id="admin-main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 outline-none md:px-8">
        {children}
      </main>
      <AdminAdSlot />
    </div>
  );
}
