"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutSuperAdminAction } from "@/app/superadmin/actions";

const navItems = [
  { href: "/superadmin", label: "운영 현황" },
  { href: "/superadmin/users", label: "사용자·가족" },
  { href: "/superadmin/payments", label: "과거 결제·환불" },
  { href: "/superadmin/audit", label: "감사 로그" },
];

export function SuperAdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="최종관리자 메뉴" className="border-b border-slate-200 bg-white px-4 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-2 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-1">
            {navItems.map((item) => {
              const isExact = pathname === item.href;
              const isActive = item.href === "/superadmin"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isExact ? "page" : isActive ? "location" : undefined}
                  className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 py-3 text-sm font-bold transition active:translate-y-px ${
                    isActive
                      ? "bg-teal-50 text-teal-800"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <form action={logoutSuperAdminAction} className="flex justify-end">
          <button className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-teal-600 hover:text-teal-800 active:translate-y-px">
            로그아웃
          </button>
        </form>
      </div>
    </nav>
  );
}
