import Link from "next/link";

const navItems = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/videos", label: "영상 목록" },
  { href: "/admin/videos/new", label: "영상 등록" },
  { href: "/admin/tags", label: "태그 관리" },
];

export function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-3 md:px-8">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-ink"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
