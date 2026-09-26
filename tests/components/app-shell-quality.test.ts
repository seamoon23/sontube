import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("restricted app quality contracts", () => {
  it("keeps startup and settings state usable on mobile and assistive technology", () => {
    const source = readProjectFile("components/app/app-shell.tsx");

    expect(source).not.toContain("min-h-screen");
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source).toContain("parentAnswerRef.current?.focus({ preventScroll: true })");
    expect(source).toContain("aria-expanded={settingsOpen || parentGateOpen || isInitialSetup}");
    expect(source).toContain('id="parent-gate-region"');
    expect(source).toContain('id="parent-settings-region"');
    expect(source).toContain("settingsButtonRef.current?.focus({ preventScroll: true })");
    expect(source).toContain("appKeyInputRef.current?.focus({ preventScroll: true })");
  });

  it("keeps catalog search, selection, and playback state explicit", () => {
    const source = readProjectFile("components/app/app-shell.tsx");

    expect(source).toContain('type="search"');
    expect(source).toContain('enterKeyHint="search"');
    expect(source).toContain("aria-pressed={activeVideoId === video.id}");
    expect(source).toContain("aria-pressed={active}");
    expect(source).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(source).toContain('title={`${activeVideo.title} YouTube 플레이어`}');
    expect(source).toContain('role={messageTone === "error" ? "alert" : "status"}');
    expect(source).not.toContain("error.message");
  });
});

describe("kids catalog recovery contracts", () => {
  it("offers a clear route back when search filters return no videos", () => {
    const source = readProjectFile("app/kids/page.tsx");

    expect(source).toContain('role="search" aria-label="승인 영상 검색"');
    expect(source).toContain('href="/kids"');
    expect(source).toContain("전체 영상 보기");
    expect(source).toContain("부모님이 확인한 영상이 등록되면 이곳에 나타납니다.");
  });
});
