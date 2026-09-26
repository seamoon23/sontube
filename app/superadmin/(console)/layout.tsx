import { SuperAdminNav } from "@/components/superadmin/superadmin-nav";
import { requireSuperAdminSession } from "@/lib/superadmin-session";

export default async function SuperAdminConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSuperAdminSession();

  return (
    <div className="min-h-[100dvh] bg-slate-100 text-slate-900">
      <a
        href="#superadmin-main"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-soft focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-teal-600"
      >
        본문으로 건너뛰기
      </a>
      <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-extrabold text-teal-700">SonTube Operations</p>
              <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-bold text-teal-800">
                최종관리자 전용
              </span>
            </div>
            <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950 md:text-2xl">
              서비스 운영 콘솔
            </h1>
          </div>
          <div className="min-w-0 max-w-full text-left text-xs leading-5 text-slate-500 sm:text-right">
            <p>로그인 계정</p>
            <p className="break-all font-mono font-bold text-slate-800">{session.loginId}</p>
          </div>
        </div>
      </header>
      <SuperAdminNav />
      <main
        id="superadmin-main"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl px-4 py-6 outline-none md:px-8 md:py-8"
      >
        {children}
      </main>
    </div>
  );
}
