import { AdminNav } from "@/components/admin/admin-nav";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-ink px-4 py-5 text-white md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-sky-200">SonTube Admin</p>
            <h1 className="text-2xl font-bold">보호자 영상 관리</h1>
          </div>
        </div>
      </header>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
