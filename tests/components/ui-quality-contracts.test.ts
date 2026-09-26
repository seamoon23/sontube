import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function openingXmlTag(source: string, tagName: string, id: string) {
  const match = source.match(
    new RegExp(`<${tagName}\\b[^>]*android:id="@\\+id/${id}"[^>]*>`),
  );

  expect(match, `${tagName}#${id} 요소가 필요합니다.`).not.toBeNull();
  return match?.[0] ?? "";
}

describe("public screen accessibility contracts", () => {
  it("keeps a keyboard skip link connected to the main landmark on both public pages", () => {
    for (const path of ["app/page.tsx", "app/lite/page.tsx"]) {
      const source = readProjectFile(path);

      expect(source).toContain('href="#main-content"');
      expect(source).toMatch(/<main\s+id="main-content"/);
    }
  });

  it("keeps the Lite fullscreen player modal-labelled and restores keyboard focus", () => {
    const source = readProjectFile("components/lite/lite-viewer.tsx");

    expect(source).toContain('role={isPlayerExpanded ? "dialog" : undefined}');
    expect(source).toContain("aria-modal={isPlayerExpanded || undefined}");
    expect(source).toContain('aria-label={isPlayerExpanded ? `${activeVideo.title} 전체화면 플레이어` : undefined}');
    expect(source).toContain("fullscreenCloseRef.current?.focus({ preventScroll: true })");
    expect(source).toContain("fullscreenTriggerRef.current?.focus({ preventScroll: true })");
    expect(source).toContain('document.addEventListener("focusin", keepFocusInsidePlayer)');
    expect(source).toContain('document.removeEventListener("focusin", keepFocusInsidePlayer)');
  });

  it("keeps Lite search mobile-friendly and the saved videos exposed as a semantic list", () => {
    const source = readProjectFile("components/lite/lite-viewer.tsx");

    expect(source).toContain('enterKeyHint="search"');
    expect(source).toContain('autoComplete="off"');
    expect(source).toContain('spellCheck={false}');
    expect(source).toContain('<ul className="flex snap-x gap-3 overflow-x-auto overscroll-x-contain pb-1" aria-label="내 목록에 담은 영상">');
    expect(source).toContain('motion-reduce:transform-none motion-reduce:transition-none');
  });
});

describe("restricted child app accessibility contracts", () => {
  it("keeps the subdued settings affordance named and touch-sized, with announced gate errors", () => {
    const source = readProjectFile("components/app/app-shell.tsx");
    const settingsButton = source.match(
      /<button[\s\S]*?onClick=\{requestSettings\}[\s\S]*?<\/button>/,
    )?.[0];

    expect(settingsButton).toContain('aria-label="설정"');
    expect(settingsButton).toMatch(/className="[^"]*\bh-11\b[^"]*\bw-11\b/);
    expect(settingsButton).toMatch(/className="[^"]*\bopacity-40\b/);
    expect(source).toContain('aria-describedby={parentGateError ? "parent-gate-error" : undefined}');
    expect(source).toMatch(/id="parent-gate-error"[^>]*role="alert"/);
  });

  it("keeps the Android fallback usable with system insets, announcements, and a 48dp retry target", () => {
    const source = readProjectFile("android-client/app/src/main/res/layout/activity_main.xml");
    const root = openingXmlTag(source, "FrameLayout", "root");
    const progress = openingXmlTag(source, "ProgressBar", "progress");
    const errorTitle = openingXmlTag(source, "TextView", "error_title");
    const retryButton = openingXmlTag(source, "Button", "retry_button");

    expect(root).toContain('android:fitsSystemWindows="true"');
    expect(progress).toContain('android:importantForAccessibility="no"');
    expect(errorTitle).toContain('android:accessibilityLiveRegion="polite"');
    expect(retryButton).toContain('android:minHeight="48dp"');
    expect(retryButton).toContain('android:minWidth="160dp"');
  });
});
