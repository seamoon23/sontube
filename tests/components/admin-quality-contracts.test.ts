import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("admin surface quality contracts", () => {
  it("keeps the parent login inside a main landmark and protected pages below the shell heading", () => {
    const loginPage = readProjectFile("app/admin/login/page.tsx");
    const appKeysPage = readProjectFile("app/admin/app-keys/page.tsx");

    expect(loginPage).toContain('<main className="w-full">');
    expect(appKeysPage).toContain('<h2 className="text-2xl font-bold text-ink">동기화 앱 키</h2>');
  });

  it("distinguishes an exact final-admin page from its nested current location", () => {
    const source = readProjectFile("components/superadmin/superadmin-nav.tsx");

    expect(source).toContain('const isExact = pathname === item.href;');
    expect(source).toContain('aria-current={isExact ? "page" : isActive ? "location" : undefined}');
  });

  it("names the exact parent-admin operation while a mutation is pending", () => {
    const appKeys = readProjectFile("components/admin/app-key-manager.tsx");
    const channels = readProjectFile("components/admin/channel-manager.tsx");
    const tags = readProjectFile("components/admin/tag-manager.tsx");

    expect(appKeys).toContain('? "비활성화 중"');
    expect(channels).toContain('? "병합 중"');
    expect(tags).toContain('? "저장 중"');
  });

  it("allows long privileged account identifiers to wrap on narrow screens", () => {
    const layout = readProjectFile("app/superadmin/(console)/layout.tsx");
    const banner = readProjectFile("components/admin/impersonation-banner.tsx");

    expect(layout).toContain('className="break-all font-mono font-bold text-slate-800"');
    expect(banner).toContain('<span className="break-all font-mono">');
  });
});
