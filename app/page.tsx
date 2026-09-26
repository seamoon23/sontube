import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SonTube | 아이를 위한 작은 영상서랍",
  description: "유튜브 전체 검색 대신, 어른이 골라 둔 영상만 아이가 직접 찾고 재생하는 제한형 영상 뷰어입니다.",
};

const VISIBLE_ITEMS = ["공개된 영상만", "제목과 태그 검색", "채널별 모아보기", "이 기기의 내 목록"];
const HIDDEN_ITEMS = ["유튜브 전체 검색", "댓글과 추천 피드", "관리자 메뉴", "가족의 비공개 목록"];

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-slate-50 text-ink">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[200] rounded-md bg-ink px-4 py-3 text-sm font-black text-white shadow-soft focus:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
      >
        본문으로 건너뛰기
      </a>
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8" aria-label="주요 메뉴">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-sm text-lg font-black tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2" aria-label="SonTube 홈">SonTube</Link>
          <Link href="/lite" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md bg-ocean px-4 py-2 text-sm font-black text-white transition hover:bg-sky-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none">Lite 체험하기</Link>
        </nav>
      </header>

      <main id="main-content">
      <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl content-center gap-10 px-4 py-14 md:px-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:gap-16">
        <div className="grid content-center gap-6">
          <p className="text-sm font-black text-ocean">공개 체험은 Lite, 가족 목록은 Android</p>
          <h1 className="max-w-3xl break-keep text-balance text-4xl font-black leading-[1.12] tracking-tight text-ink md:text-5xl lg:text-6xl">유튜브 전체 대신, 골라 둔 영상만 보여주세요</h1>
          <p className="max-w-xl text-pretty text-base leading-7 text-slate-600 md:text-lg">Lite는 SonTube의 공용 목록을, Android 앱은 보호자가 승인한 가족 목록을 보여줍니다.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/lite" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md bg-ocean px-5 py-3 text-sm font-black text-white transition hover:bg-sky-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none">Lite 체험하기</Link>
            <Link href="#android-app" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:border-ocean hover:text-ocean active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none">Android 앱 알아보기</Link>
          </div>
        </div>

        <aside className="grid content-center gap-3" aria-label="SonTube 아이 화면에서 제공하거나 제한하는 기능">
          <section className="rounded-xl border border-sky-200 bg-sky-50 p-5 shadow-[0_18px_45px_rgba(3,105,161,0.09)]">
            <h2 className="text-lg font-black text-ink">아이 화면에서 보이는 것</h2>
            <ul className="mt-4 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              {VISIBLE_ITEMS.map((item) => <li key={item} className="rounded-md border border-sky-100 bg-white px-3 py-3 text-sm font-bold text-slate-700">{item}</li>)}
            </ul>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-black text-slate-700">열지 않는 영역</h2>
            <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm font-semibold text-slate-500 min-[360px]:grid-cols-2">
              {HIDDEN_ITEMS.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </aside>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:px-8 md:py-20">
          <div className="grid content-start gap-4">
            <h2 className="break-keep text-balance text-3xl font-black tracking-tight text-ink md:text-4xl">작은 목록 안에서 스스로 고릅니다</h2>
            <p className="max-w-lg text-pretty text-base leading-7 text-slate-600">제목과 보호자 키워드로 찾고, 태그와 채널로 범위를 좁힙니다. 선택한 영상은 주소창 없는 전용 앱에서도 같은 방식으로 재생됩니다.</p>
          </div>
          <dl className="grid gap-6 sm:grid-cols-2">
            <div className="border-l-4 border-ocean pl-4"><dt className="font-black text-ink">전체 검색 없음</dt><dd className="mt-2 text-sm leading-6 text-slate-600">등록된 목록 밖의 영상을 SonTube 검색으로 찾아가지 않습니다.</dd></div>
            <div className="border-l-4 border-ocean pl-4"><dt className="font-black text-ink">아이 중심 탐색</dt><dd className="mt-2 text-sm leading-6 text-slate-600">짧은 검색어와 태그, 채널 모아보기로 보고 싶은 영상을 고릅니다.</dd></div>
            <div className="border-l-4 border-ocean pl-4 sm:col-span-2"><dt className="font-black text-ink">영상은 YouTube 플레이어로 재생</dt><dd className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">영상 파일을 저장하거나 광고를 변조하지 않습니다. YouTube 플레이어 자체 광고와 내부 요소는 계정 및 정책에 따라 보일 수 있습니다.</dd></div>
          </dl>
        </div>
      </section>

      <section id="android-app" tabIndex={-1} aria-labelledby="android-app-title" className="mx-auto grid scroll-mt-6 max-w-6xl gap-8 px-4 py-16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean focus-visible:outline-offset-4 md:px-8 md:py-20">
        <div className="grid max-w-2xl gap-3">
          <h2 id="android-app-title" className="break-keep text-balance text-3xl font-black tracking-tight text-ink md:text-4xl">웹으로 가볍게, 앱으로 단단하게</h2>
          <p className="text-pretty text-base leading-7 text-slate-600">공개 Lite와 가족별 Android 앱은 같은 화면 경험을 공유하지만, 보호 범위는 다릅니다.</p>
        </div>
        <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white md:grid-cols-2">
          <section className="p-6 md:p-8">
            <p className="text-sm font-black text-ocean">SonTube Lite</p><h3 className="mt-2 text-2xl font-black text-ink">설치 없이 공개 목록 보기</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">SonTube가 공개용으로 선별한 공용 목록을 이용합니다. 내 목록은 현재 브라우저에만 저장됩니다.</p>
            <Link href="/lite" className="mt-6 inline-flex min-h-11 items-center whitespace-nowrap rounded-md bg-ocean px-4 py-2.5 text-sm font-black text-white transition hover:bg-sky-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none">Lite 체험하기</Link>
          </section>
          <section className="border-t border-slate-200 bg-slate-50 p-6 md:border-l md:border-t-0 md:p-8">
            <p className="text-sm font-black text-ocean">SonTube Android</p><h3 className="mt-2 text-2xl font-black text-ink">우리 가족의 승인 목록</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">가족별 영상 승인, 기기 화면 고정, 외부 URL 차단과 통신 정책은 Android 전용 앱에서 제공합니다.</p>
            <p className="mt-6 text-sm font-bold text-slate-500">Android 앱은 보호자 안내를 통해 설치합니다.</p>
          </section>
        </div>
      </section>
      </main>

      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-8"><p className="font-black text-ink">SonTube</p><p>공개 목록도 아이에게 보여주기 전에 보호자가 먼저 확인해 주세요.</p></div></footer>
    </div>
  );
}
