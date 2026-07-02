import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl content-center gap-8 px-5 py-12">
      <section className="grid gap-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ocean">SonTube</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight text-ink md:text-6xl">
          아이 전용 영상서랍
        </h1>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/kids"
            className="rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            아이 화면
          </Link>
          <Link
            href="/admin"
            className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-ocean hover:text-ocean"
          >
            관리자
          </Link>
        </div>
      </section>
    </main>
  );
}
