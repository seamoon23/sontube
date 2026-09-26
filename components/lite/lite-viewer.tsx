"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import type { AppCatalog, AppCatalogVideo } from "@/lib/app-catalog";
import { buildEmbedUrl } from "@/lib/youtube";
import {
  buildLiteChannelFacets,
  buildLiteTagFacets,
  filterLiteVideos,
  LITE_PLAYLIST_STORAGE_KEY,
  MAX_LITE_PLAYLIST_ITEMS,
  normalizeLitePlaylist,
  readLiteCatalogResponse,
  toggleLitePlaylist,
} from "@/components/lite/lite-model";

type LoadState = "loading" | "ready" | "error";
const EMPTY_VIDEOS: AppCatalogVideo[] = [];

export function LiteViewer() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [catalog, setCatalog] = useState<AppCatalog | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [playlistIds, setPlaylistIds] = useState<string[]>([]);
  const [playlistReady, setPlaylistReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<HTMLElement>(null);
  const playerHeadingRef = useRef<HTMLHeadingElement>(null);
  const fullscreenTriggerRef = useRef<HTMLButtonElement>(null);
  const fullscreenCloseRef = useRef<HTMLButtonElement>(null);
  const playlistHeadingRef = useRef<HTMLHeadingElement>(null);
  const catalogHeadingRef = useRef<HTMLHeadingElement>(null);
  const wasPlayerExpandedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCatalog() {
      setLoadState("loading");
      setCatalog(null);
      try {
        const response = await fetch("/api/lite/catalog", {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const nextCatalog = readLiteCatalogResponse(await response.json());
        if (!response.ok || !nextCatalog) throw new Error("invalid public catalog response");
        if (controller.signal.aborted) return;
        setCatalog(nextCatalog);
        setActiveVideoId((current) => nextCatalog.videos.some((video) => video.id === current) ? current : null);
        setLoadState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("Failed to load the public Lite catalog.", error);
        setLoadState("error");
      }
    }
    void loadCatalog();
    return () => controller.abort();
  }, [loadAttempt]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(LITE_PLAYLIST_STORAGE_KEY) ?? "[]");
      setPlaylistIds(normalizeLitePlaylist(stored));
    } catch {
      setPlaylistIds([]);
    } finally {
      setPlaylistReady(true);
    }
  }, []);

  useEffect(() => {
    if (!playlistReady) return;
    try {
      window.localStorage.setItem(LITE_PLAYLIST_STORAGE_KEY, JSON.stringify(playlistIds));
    } catch {
      setStatusMessage("이 브라우저에서는 내 목록을 저장할 수 없습니다.");
    }
  }, [playlistIds, playlistReady]);

  useEffect(() => {
    if (!isPlayerExpanded) {
      if (!wasPlayerExpandedRef.current) return;
      wasPlayerExpandedRef.current = false;
      const focusFrame = window.requestAnimationFrame(() => {
        fullscreenTriggerRef.current?.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(focusFrame);
    }

    wasPlayerExpandedRef.current = true;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      fullscreenCloseRef.current?.focus({ preventScroll: true });
    });

    function handleFullscreenChange() {
      if (!document.fullscreenElement) setIsPlayerExpanded(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.fullscreenElement) setIsPlayerExpanded(false);
    }

    function keepFocusInsidePlayer(event: FocusEvent) {
      const focusTarget = event.target;
      if (
        focusTarget instanceof Node &&
        playerRef.current &&
        !playerRef.current.contains(focusTarget)
      ) {
        fullscreenCloseRef.current?.focus({ preventScroll: true });
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", keepFocusInsidePlayer);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", keepFocusInsidePlayer);
    };
  }, [isPlayerExpanded]);

  const videos = catalog?.videos ?? EMPTY_VIDEOS;
  const tags = useMemo(() => buildLiteTagFacets(videos), [videos]);
  const channels = useMemo(() => buildLiteChannelFacets(videos), [videos]);
  const visibleVideos = useMemo(
    () => filterLiteVideos(videos, query, selectedTag, selectedChannelId),
    [query, selectedChannelId, selectedTag, videos],
  );
  const activeVideo = videos.find((video) => video.id === activeVideoId) ?? null;
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) ?? null;
  const playlistVideos = playlistIds
    .map((id) => videos.find((video) => video.id === id))
    .filter((video): video is AppCatalogVideo => Boolean(video));

  function chooseVideo(video: AppCatalogVideo) {
    setActiveVideoId(video.id);
    setStatusMessage(`${video.title} 영상을 선택했습니다.`);
    window.setTimeout(() => {
      playerHeadingRef.current?.focus({ preventScroll: true });
      playerRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    }, 0);
  }

  function chooseChannel(channelId: string) {
    setSelectedChannelId(channelId);
    setActiveVideoId(null);
  }

  function showChannel(channelId: string) {
    setQuery("");
    setSelectedTag("");
    setSelectedChannelId(channelId);
    setActiveVideoId(null);
    window.requestAnimationFrame(() => {
      catalogHeadingRef.current?.focus({ preventScroll: true });
    });
  }

  function clearFilters() {
    setQuery("");
    setSelectedTag("");
    setSelectedChannelId(null);
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
  }

  function togglePlaylist(video: AppCatalogVideo) {
    const wasSaved = playlistIds.includes(video.id);
    const nextIds = toggleLitePlaylist(playlistIds, video.id);
    const wasAdded = nextIds.includes(video.id);
    setPlaylistIds(nextIds);
    setStatusMessage(
      wasSaved
        ? `${video.title} 영상을 내 목록에서 뺐습니다.`
        : wasAdded
          ? `${video.title} 영상을 내 목록에 담았습니다.`
          : `내 목록에는 최대 ${MAX_LITE_PLAYLIST_ITEMS}개까지 담을 수 있습니다. 기존 영상을 먼저 빼 주세요.`,
    );
  }

  function removePlaylistVideo(video: AppCatalogVideo) {
    togglePlaylist(video);
    window.requestAnimationFrame(() => {
      const nextFocusTarget = playlistHeadingRef.current ?? catalogHeadingRef.current;
      nextFocusTarget?.focus({ preventScroll: true });
    });
  }

  async function enterFullscreen() {
    setIsPlayerExpanded(true);
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setStatusMessage("브라우저 전체화면 대신 플레이어를 화면에 크게 표시했습니다.");
    }
  }

  async function exitFullscreen() {
    setIsPlayerExpanded(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // The fixed overlay is already closed even if the browser rejects exitFullscreen.
    }
  }

  if (loadState === "loading") return <LiteLoading />;
  if (loadState === "error") {
    return (
      <section className="mx-4 my-8 max-w-2xl rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-[0_14px_35px_rgba(23,32,42,0.06)] sm:mx-auto md:px-8" role="alert">
        <h2 className="text-2xl font-black text-ink">공개 목록을 불러오지 못했어요</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">연결 상태를 확인한 뒤 다시 시도해 주세요. 샘플이나 가족의 비공개 목록을 대신 보여주지 않습니다.</p>
        <button type="button" onClick={() => setLoadAttempt((current) => current + 1)} className="mt-6 min-h-11 whitespace-nowrap rounded-md bg-ocean px-4 py-2.5 text-sm font-black text-white transition hover:bg-sky-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none">다시 시도</button>
      </section>
    );
  }
  if (videos.length === 0) {
    return (
      <section className="mx-4 my-8 max-w-2xl rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-[0_14px_35px_rgba(23,32,42,0.06)] sm:mx-auto md:px-8" role="status" aria-live="polite" aria-atomic="true">
        <h2 className="text-2xl font-black text-ink">현재 공개된 영상이 없습니다</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">검수를 마친 공용 목록이 준비되면 여기에 표시됩니다. 샘플이나 다른 가족의 목록은 자동으로 채우지 않습니다.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:px-8 md:py-8">
      {statusMessage && (
        <p className="break-words rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900" role="status" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </p>
      )}
      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_14px_35px_rgba(23,32,42,0.06)] md:p-5">
        <div className="grid gap-2">
          <label htmlFor="lite-search" className="text-sm font-black text-slate-700">제목 또는 보호자 키워드 검색</label>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input ref={searchInputRef} id="lite-search" type="search" enterKeyHint="search" autoComplete="off" spellCheck={false} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 동물, 과학, 영어" className="min-h-11 min-w-0 rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-ink outline-none placeholder:text-slate-500 focus:border-ocean focus:ring-2 focus:ring-sky-100" />
            {(query || selectedTag || selectedChannelId) && <button type="button" onClick={clearFilters} className="min-h-11 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-ocean hover:text-ocean active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none">조건 지우기</button>}
          </div>
        </div>
        <FilterRow label="태그">
          <FilterButton active={!selectedTag} onClick={() => setSelectedTag("")}>모든 태그</FilterButton>
          {tags.map((tag) => <FilterButton key={tag.slug} active={selectedTag === tag.slug} onClick={() => setSelectedTag(tag.slug)}>{tag.name} {tag.count}</FilterButton>)}
        </FilterRow>
        {channels.length > 0 && (
          <FilterRow label="채널">
            <FilterButton active={!selectedChannelId} onClick={() => setSelectedChannelId(null)}>모든 채널</FilterButton>
            {channels.map((channel) => <FilterButton key={channel.id} active={selectedChannelId === channel.id} onClick={() => chooseChannel(channel.id)}>{channel.name} {channel.count}</FilterButton>)}
          </FilterRow>
        )}
      </section>

      {activeVideo && (
        <section
          ref={playerRef}
          role={isPlayerExpanded ? "dialog" : undefined}
          aria-modal={isPlayerExpanded || undefined}
          aria-label={isPlayerExpanded ? `${activeVideo.title} 전체화면 플레이어` : undefined}
          className={isPlayerExpanded ? "fixed inset-0 z-[100] overscroll-contain bg-slate-950" : "scroll-mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(23,32,42,0.08)]"}
        >
          <div className={isPlayerExpanded ? "absolute inset-0" : "bg-slate-950"}>
            {isPlayerExpanded && <button ref={fullscreenCloseRef} type="button" onClick={() => void exitFullscreen()} className="lite-fullscreen-close absolute z-10 min-h-11 rounded-md bg-slate-950/80 px-3 py-2 text-sm font-black text-white shadow-lg transition hover:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none">전체화면 닫기</button>}
            <iframe key={activeVideo.id} src={buildEmbedUrl(activeVideo.youtubeVideoId)} title={`${activeVideo.title} YouTube 플레이어`} className={isPlayerExpanded ? "h-full w-full" : "aspect-video max-h-[100dvh] w-full"} sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; autoplay; encrypted-media; fullscreen; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
          <div className={isPlayerExpanded ? "hidden" : "grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:p-6"}>
            <div className="min-w-0">
              <h2 ref={playerHeadingRef} tabIndex={-1} className="break-words text-xl font-black text-ink outline-none focus-visible:ring-2 focus-visible:ring-ocean md:text-2xl">{activeVideo.title}</h2>
              {activeVideo.channel && <button type="button" onClick={() => showChannel(activeVideo.channel!.id)} aria-label={`${activeVideo.channel.name} 채널의 공개 영상 더보기`} className="mt-2 inline-flex min-h-11 max-w-full items-center break-words text-left text-sm font-black text-ocean underline decoration-sky-200 underline-offset-4 hover:decoration-ocean focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean">{activeVideo.channel.name} 영상 더보기</button>}
              {activeVideo.description && <p className="mt-3 max-w-3xl break-words text-sm leading-6 text-slate-600">{activeVideo.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {activeVideo.tags.map((tag) => <span key={tag.id} className="max-w-full break-words rounded-md bg-sky-50 px-2 py-1 text-xs font-black text-sky-800">{tag.name}</span>)}
                {activeVideo.durationText && <span className="max-w-full break-words rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{activeVideo.durationText}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <button ref={fullscreenTriggerRef} type="button" onClick={() => void enterFullscreen()} className="min-h-11 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:border-ocean hover:text-ocean active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none">전체화면</button>
              <PlaylistButton videoTitle={activeVideo.title} saved={playlistIds.includes(activeVideo.id)} onClick={() => togglePlaylist(activeVideo)} />
            </div>
          </div>
        </section>
      )}

      {playlistVideos.length > 0 && (
        <section className="grid gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 md:p-5" aria-labelledby="lite-playlist-title">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 ref={playlistHeadingRef} tabIndex={-1} id="lite-playlist-title" className="rounded-sm text-lg font-black text-ink outline-none focus-visible:ring-2 focus-visible:ring-ocean">내 목록</h2><p className="mt-1 text-xs font-semibold text-slate-600">이 브라우저에만 저장됩니다.</p></div><span className="text-xs font-black text-slate-500">{playlistVideos.length}개</span></div>
          <ul className="flex snap-x gap-3 overflow-x-auto overscroll-x-contain pb-1" aria-label="내 목록에 담은 영상">
            {playlistVideos.map((video) => (
              <li key={video.id} className="w-52 shrink-0 snap-start overflow-hidden rounded-lg border border-sky-200 bg-white">
                <button type="button" onClick={() => chooseVideo(video)} aria-label={`${video.title} 플레이어 열기`} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ocean"><img src={video.thumbnailUrl} alt="" className="aspect-video w-full bg-slate-100 object-cover" loading="lazy" decoding="async" onError={usePlaceholderThumbnail} /><span className="line-clamp-2 break-words p-3 text-sm font-black text-ink">{video.title}</span></button>
                <button type="button" onClick={() => removePlaylistVideo(video)} aria-label={`${video.title} 내 목록에서 빼기`} className="mx-3 mb-3 inline-flex min-h-11 items-center rounded-sm text-xs font-black text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean">목록에서 빼기</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4" aria-labelledby="lite-catalog-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0"><h2 ref={catalogHeadingRef} tabIndex={-1} id="lite-catalog-title" className="break-words rounded-sm text-xl font-black text-ink outline-none focus-visible:ring-2 focus-visible:ring-ocean">{selectedChannel ? `${selectedChannel.name} 영상` : "공개 영상 목록"}</h2><p className="mt-1 text-sm text-slate-600">검색과 필터는 현재 공개된 목록 안에서만 작동합니다.</p></div>
          <span className="shrink-0 text-sm font-black text-slate-500" aria-hidden="true">
            검색 결과 {visibleVideos.length}개
          </span>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {visibleVideos.length === 0 ? "조건에 맞는 영상이 없습니다." : `검색 결과 ${visibleVideos.length}개입니다.`}
          </span>
        </div>
        {visibleVideos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><h3 className="font-black text-ink">조건에 맞는 영상이 없습니다</h3><p className="mt-2 text-sm text-slate-600">검색어나 필터를 지우고 다시 살펴보세요.</p><button type="button" onClick={clearFilters} className="mt-5 inline-flex min-h-11 items-center rounded-sm text-sm font-black text-ocean underline decoration-sky-200 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean">전체 목록 보기</button></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleVideos.map((video) => <VideoCard key={video.id} video={video} saved={playlistIds.includes(video.id)} onChoose={() => chooseVideo(video)} onTogglePlaylist={() => togglePlaylist(video)} onChooseChannel={video.channel ? () => showChannel(video.channel!.id) : undefined} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function LiteLoading() {
  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 md:px-8" aria-busy="true" aria-live="polite" aria-atomic="true" aria-label="공개 영상 목록 불러오는 중" role="status">
      <span className="sr-only">공개 영상 목록을 불러오는 중입니다.</span>
      <div className="h-48 rounded-xl border border-slate-200 bg-white motion-safe:animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="aspect-video bg-slate-200 motion-safe:animate-pulse" /><div className="grid gap-2 p-4"><div className="h-5 w-4/5 rounded-md bg-slate-200 motion-safe:animate-pulse" /><div className="h-4 w-2/5 rounded-md bg-slate-100 motion-safe:animate-pulse" /></div></div>)}</div>
    </section>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return <fieldset className="grid min-w-0 gap-2"><legend className="text-xs font-black text-slate-500">{label}</legend><div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1">{children}</div></fieldset>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`min-h-11 shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-xs font-black transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none ${active ? "border-ocean bg-ocean text-white" : "border-slate-300 bg-white text-slate-700 hover:border-ocean hover:text-ocean"}`}>{children}</button>;
}

function VideoCard({ video, saved, onChoose, onTogglePlaylist, onChooseChannel }: { video: AppCatalogVideo; saved: boolean; onChoose: () => void; onTogglePlaylist: () => void; onChooseChannel?: () => void }) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_28px_rgba(23,32,42,0.05)] transition hover:-translate-y-0.5 hover:border-sky-300 motion-reduce:hover:translate-y-0 motion-reduce:transition-none">
      <img src={video.thumbnailUrl} alt="" className="aspect-video w-full bg-slate-100 object-cover" loading="lazy" decoding="async" onError={usePlaceholderThumbnail} />
      <div className="grid gap-3 p-4">
        <div className="min-w-0"><h3 className="line-clamp-2 break-words text-base font-black text-ink">{video.title}</h3><div className="mt-2 flex min-w-0 items-center justify-between gap-3 text-xs font-semibold text-slate-500">{video.channel && onChooseChannel ? <button type="button" onClick={onChooseChannel} aria-label={`${video.channel.name} 채널의 공개 영상 더보기`} className="inline-flex min-h-11 min-w-0 items-center truncate rounded-sm text-left font-black hover:text-ocean hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean">{video.channel.name} 더보기</button> : <span />}{video.durationText && <span className="max-w-[40%] shrink-0 truncate" title={video.durationText}>{video.durationText}</span>}</div></div>
        {video.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{video.tags.slice(0, 4).map((tag) => <span key={tag.id} className="max-w-full break-words rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{tag.name}</span>)}</div>}
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2"><button type="button" onClick={onChoose} aria-label={`${video.title} 플레이어 열기`} className="min-h-11 rounded-md bg-ocean px-3 py-2.5 text-sm font-black text-white transition hover:bg-sky-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none">플레이어 열기</button><PlaylistButton videoTitle={video.title} saved={saved} onClick={onTogglePlaylist} /></div>
      </div>
    </article>
  );
}

function PlaylistButton({ videoTitle, saved, onClick }: { videoTitle: string; saved: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={`${videoTitle} ${saved ? "내 목록에서 빼기" : "내 목록 담기"}`} aria-pressed={saved} className={`min-h-11 whitespace-nowrap rounded-md border px-3 py-2.5 text-sm font-black transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none ${saved ? "border-ocean bg-sky-50 text-sky-800" : "border-slate-300 bg-white text-slate-700 hover:border-ocean hover:text-ocean"}`}>{saved ? "내 목록에 담김" : "내 목록 담기"}</button>;
}

function usePlaceholderThumbnail(event: SyntheticEvent<HTMLImageElement>) {
  if (!event.currentTarget.src.endsWith("/thumbnail-placeholder.svg")) event.currentTarget.src = "/thumbnail-placeholder.svg";
}
