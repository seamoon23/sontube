"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAdminAction } from "@/app/admin/login/actions";
import { AdminGuideButton } from "@/components/admin/admin-guide";

const navItems = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/videos", label: "영상 목록" },
  { href: "/admin/videos/new", label: "영상 등록" },
  { href: "/admin/channels", label: "채널" },
  { href: "/admin/tags", label: "태그 관리" },
  { href: "/admin/insights", label: "관심 요약" },
  { href: "/admin/app-keys", label: "앱 키" },
  { href: "/admin/payment", label: "이용권·결제" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      id="admin-nav"
      aria-label="관리자 메뉴"
      className="grid gap-2 border-b border-slate-200 bg-white px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-8"
    >
      <div className="w-full overflow-x-auto">
        <div className="flex min-w-max gap-1">
          {navItems.map((item) => {
            const isExact = pathname === item.href;
            const isActive = isCurrentNavItem(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isExact ? "page" : isActive ? "location" : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-100 text-ink"
                    : "text-slate-700 hover:bg-slate-100 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex min-h-11 items-stretch justify-end gap-2">
        <AdminGuideButton />
        <form action={logoutAdminAction}>
          <button className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-ocean hover:text-ocean">
            로그아웃
          </button>
        </form>
      </div>
    </nav>
  );
}

function isCurrentNavItem(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === href;
  if (href === "/admin/videos/new") return pathname === href;
  if (href === "/admin/videos") {
    return pathname === href || /^\/admin\/videos\/[^/]+\/edit$/.test(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
