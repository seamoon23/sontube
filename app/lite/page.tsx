import type { Metadata } from "next";
import Link from "next/link";
import { LiteViewer } from "@/components/lite/lite-viewer";

export const metadata: Metadata = {
  title: "SonTube Lite | 공개 영상서랍",
  description: "SonTube가 공개용으로 선별한 공용 영상 목록을 검색하고 재생합니다.",
  robots: { index: false, follow: false, nocache: true },
};

export default function LitePage() {
  return (
    <div className="min-h-[100dvh] bg-slate-50 text-ink">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[200] rounded-md bg-ink px-4 py-3 text-sm font-black text-white shadow-soft focus:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
      >
        본문으로 건너뛰기
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 md:px-8">
          <Link href="/" className="inline-flex min-h-11 min-w-0 items-center rounded-sm text-lg font-black tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2" aria-label="SonTube 소개로 돌아가기">SonTube <span className="ml-1 text-ocean">Lite</span></Link>
          <Link href="/" className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-sm text-sm font-black text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-ocean focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2">보호자 안내</Link>
        </div>
      </header>
      <main id="main-content">
        <section className="border-b border-sky-200 bg-sky-50">
          <div className="mx-auto grid max-w-7xl gap-2 px-4 py-4 md:px-8">
            <h1 className="break-keep text-balance text-xl font-black text-ink md:text-2xl">공개용 공용 영상서랍</h1>
            <p className="max-w-4xl text-pretty text-sm leading-6 text-slate-600">이 목록은 SonTube가 공개용으로 선별했습니다. 가족별 영상 승인과 기기 화면 고정, 외부 이동 차단은 Android 앱에서 제공합니다.</p>
          </div>
        </section>
        <LiteViewer />
      </main>
      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-4 py-8 text-sm leading-6 text-slate-500 md:px-8">공개 목록도 아이에게 보여주기 전에 보호자가 먼저 확인해 주세요. YouTube 플레이어 자체 요소와 광고는 정책 및 계정 상태에 따라 보일 수 있습니다.</div></footer>
    </div>
  );
}
