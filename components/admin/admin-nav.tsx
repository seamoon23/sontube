import Link from "next/link";
import { logoutAdminAction } from "@/app/admin/login/actions";

const navItems = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/videos", label: "영상 목록" },
  { href: "/admin/videos/new", label: "영상 등록" },
  { href: "/admin/tags", label: "태그 관리" },
  { href: "/admin/insights", label: "관심 요약" },
];

export function AdminNav() {
  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 md:px-8">
      <div className="flex flex-1 flex-wrap gap-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-ink"
          >
            {item.label}
          </Link>
        ))}
      </div>
      <form action={logoutAdminAction}>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-ocean hover:text-ocean">
          로그아웃
        </button>
      </form>
    </nav>
  );
}
