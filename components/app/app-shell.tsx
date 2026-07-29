"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { recordKidsSignalAction } from "@/app/kids/actions";
import { DevicePinningNotice } from "@/components/app/device-pinning-notice";
import { getKidsClientKey } from "@/components/kids/kids-client-key";
import {
  addKidsPlaylistItem,
  KIDS_PLAYLIST_STORAGE_KEY,
  normalizeKidsPlaylist,
  removeKidsPlaylistItem,
  type KidsPlaylistItem,
} from "@/lib/kids-playlist";
import { KIDS_SIGNAL_OPTIONS, type KidsFeedbackSignalType } from "@/lib/kids-signals";
import type { AppCatalog, AppCatalogVideo } from "@/lib/app-catalog";
import { buildEmbedUrl } from "@/lib/youtube";

type AppSyncAccess = {
  status: "disabled" | "trial" | "paid" | "expired";
  canSync: boolean;
  label: string;
  trialEndsAt: string;
  paidUntil: string | null;
  keyPrefix: string;
  lastSyncedAt: string | null;
  nextRecommendedSyncAt: string;
};

type AppSyncResponse =
  | {
      ok: true;
      message: string;
      access: AppSyncAccess;
      catalog: AppCatalog | null;
    }
  | {
      ok: false;
      message: string;
    };

type CachedAppSync = {
  access: AppSyncAccess;
  catalog: AppCatalog;
  syncedAt: string;
};

type ParentChallenge = {
  left: number;
  right: number;
};

const APP_KEY_STORAGE_KEY = "sontube:app-access-key";
const APP_INSTALLATION_ID_STORAGE_KEY = "sontube:app-installation-id";
const APP_SYNC_STORAGE_KEY = "sontube:app-catalog-cache";
const DAILY_SYNC_MS = 24 * 60 * 60 * 1000;
const EMPTY_APP_VIDEOS: AppCatalogVideo[] = [];

export function AppShell() {
  const [isReady, setIsReady] = useState(false);
  const [savedKey, setSavedKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [syncState, setSyncState] = useState<CachedAppSync | null>(null);
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<KidsPlaylistItem[]>([]);
  const [feedbackByVideoId, setFeedbackByVideoId] = useState<Record<string, KidsFeedbackSignalType>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [parentGateOpen, setParentGateOpen] = useState(false);
  const [parentChallenge, setParentChallenge] = useState<ParentChallenge>(() => createParentChallenge());
  const [parentAnswer, setParentAnswer] = useState("");
  const [parentGateError, setParentGateError] = useState("");

  const syncWithKey = useCallback(
    async (key: string, options: { endpoint?: string; force?: boolean } = {}) => {
      const trimmedKey = key.trim();
      const currentInstallationId = getOrCreateInstallationId();

      if (!trimmedKey) {
        setMessage("관리자 화면에서 만든 앱 키를 먼저 등록해 주세요.");
        return;
      }

      setIsSyncing(true);
      setMessage("");

      try {
        const response = await fetch(options.endpoint ?? "/api/app/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key: trimmedKey,
            installationId: currentInstallationId,
            force: Boolean(options.force),
          }),
        });
        const data = (await response.json()) as AppSyncResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.message || "동기화에 실패했습니다.");
        }

        const previousCache = readCachedSync();
        const previousCatalog = previousCache?.catalog ?? null;
        const nextCatalog = data.catalog ?? previousCatalog;
        if (!nextCatalog) {
          throw new Error("저장된 목록이 없습니다. 다시 불러오기를 시도해 주세요.");
        }

        const cached: CachedAppSync = {
          access: data.access,
          catalog: nextCatalog,
          syncedAt: data.catalog ? new Date().toISOString() : previousCache?.syncedAt ?? new Date().toISOString(),
        };

        window.localStorage.setItem(APP_KEY_STORAGE_KEY, trimmedKey);
        window.localStorage.setItem(APP_SYNC_STORAGE_KEY, JSON.stringify(cached));
        setSavedKey(trimmedKey);
        setKeyInput("");
        setSyncState(cached);
        setActiveVideoId((current) => current ?? nextCatalog.videos[0]?.id ?? null);
        setMessage(data.message);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "동기화에 실패했습니다.");
      } finally {
        setIsSyncing(false);
      }
    },
    [],
  );

  useEffect(() => {
    const key = window.localStorage.getItem(APP_KEY_STORAGE_KEY) ?? "";
    getOrCreateInstallationId();
    const cached = readCachedSync();
    const items = readPlaylist();

    setSavedKey(key);
    setKeyInput("");
    setSyncState(cached);
    setPlaylist(items);
    setActiveVideoId(cached?.catalog.videos[0]?.id ?? null);
    setIsReady(true);

    if (key && shouldSync(cached)) {
      void syncWithKey(key);
    }
  }, [syncWithKey]);

  const cachedAccess = syncState?.access ?? null;
  const access = useMemo(() => (cachedAccess ? evaluateLocalAccess(cachedAccess) : null), [cachedAccess]);
  const videos = useMemo(() => (access?.canSync ? syncState?.catalog.videos ?? EMPTY_APP_VIDEOS : EMPTY_APP_VIDEOS), [access, syncState]);
  const visibleVideos = useMemo(() => filterVideos(videos, query, selectedTag), [videos, query, selectedTag]);
  const recommendedVideos = useMemo(() => videos.filter((video) => video.isParentRecommended).slice(0, 8), [videos]);
  const hotTags = useMemo(() => buildHotTags(videos), [videos]);
  const activeVideo = videos.find((video) => video.id === activeVideoId) ?? visibleVideos[0] ?? null;
  const hasRegisteredKey = Boolean(savedKey);
  const isInitialSetup = !hasRegisteredKey;

  function submitKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void syncWithKey(keyInput, { endpoint: "/api/app/register", force: true });
  }

  function manualSync() {
    void syncWithKey(savedKey, { endpoint: "/api/app/sync", force: true });
  }

  function chooseVideo(videoId: string) {
    setActiveVideoId(videoId);
  }

  function requestSettings() {
    if (isInitialSetup || settingsOpen) {
      setSettingsOpen((current) => !current);
      return;
    }

    setParentChallenge(createParentChallenge());
    setParentAnswer("");
    setParentGateError("");
    setParentGateOpen(true);
  }

  function submitParentGate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const expected = parentChallenge.left + parentChallenge.right;

    if (Number(parentAnswer.trim()) !== expected) {
      setParentGateError("답을 다시 확인해 주세요.");
      setParentChallenge(createParentChallenge());
      setParentAnswer("");
      return;
    }

    setParentGateOpen(false);
    setSettingsOpen(true);
  }

  function togglePlaylist(video: AppCatalogVideo) {
    const current = readPlaylist();
    const isSaved = current.some((item) => item.id === video.id);
    const next = isSaved
      ? removeKidsPlaylistItem(current, video.id)
      : addKidsPlaylistItem(current, {
          id: video.id,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          durationText: video.durationText,
        });

    writePlaylist(next);
    setPlaylist(next);
    void recordKidsSignalAction({
      videoId: video.id,
      clientKey: getKidsClientKey(),
      type: "PLAYLIST",
      active: !isSaved,
    });
  }

  function recordFeedback(video: AppCatalogVideo, type: KidsFeedbackSignalType) {
    setFeedbackByVideoId((current) => ({ ...current, [video.id]: type }));
    void recordKidsSignalAction({
      videoId: video.id,
      clientKey: getKidsClientKey(),
      type,
      active: true,
    });
  }

  if (!isReady) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm font-semibold text-slate-500">불러오는 중</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-bold text-ocean">SonTube App</p>
            <h1 className="text-2xl font-black text-ink md:text-3xl">안전 영상서랍</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {access && (
              <span className={`rounded-md px-3 py-2 text-xs font-black ${getAccessClassName(access.status)}`}>
                {access.label}
              </span>
            )}
            <button
              type="button"
              onClick={requestSettings}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-ocean hover:text-ocean"
            >
              설정
            </button>
          </div>
        </div>
      </header>

      {parentGateOpen && (
        <section className="border-b border-slate-200 bg-white px-4 py-4 md:px-6">
          <form onSubmit={submitParentGate} className="mx-auto grid max-w-lg gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <h2 className="text-lg font-black text-ink">부모님 확인</h2>
              <p className="mt-1 text-sm text-slate-600">설정 화면을 열려면 간단한 확인을 완료해 주세요.</p>
            </div>
            <label className="grid gap-1 text-sm font-black text-slate-700">
              {parentChallenge.left} + {parentChallenge.right} = ?
              <input
                value={parentAnswer}
                onChange={(event) => setParentAnswer(event.target.value)}
                inputMode="numeric"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
              />
            </label>
            {parentGateError && <p className="text-sm font-semibold text-red-700">{parentGateError}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-black text-white hover:bg-slate-700">
                확인
              </button>
              <button
                type="button"
                onClick={() => setParentGateOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-ocean hover:text-ocean"
              >
                닫기
              </button>
            </div>
          </form>
        </section>
      )}

      {settingsOpen || isInitialSetup ? (
        <section className="border-b border-slate-200 bg-white px-4 py-5 md:px-6">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[1fr_1fr]">
            <form onSubmit={submitKey} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <h2 className="text-lg font-black text-ink">앱 키 등록</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  부모님 관리자 화면의 앱 키 메뉴에서 만든 키를 등록하면 승인 영상만 가져옵니다.
                </p>
              </div>
              <input
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                placeholder={hasRegisteredKey ? "새 키로 교체하려면 입력" : "st_app_..."}
                type="password"
                autoComplete="off"
                className="rounded-md border border-slate-300 px-3 py-3 font-mono text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
              />
              {hasRegisteredKey && <p className="text-xs font-semibold text-slate-500">등록된 키: {access?.keyPrefix ?? "st_app_..."}...</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isSyncing || !keyInput.trim()}
                  className="rounded-md bg-ink px-4 py-2 text-sm font-black text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  등록하고 불러오기
                </button>
                <button
                  type="button"
                  onClick={manualSync}
                  disabled={isSyncing || !hasRegisteredKey}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-ocean hover:text-ocean disabled:cursor-not-allowed disabled:opacity-50"
                >
                  다시 불러오기
                </button>
                {hasRegisteredKey && (
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-ocean hover:text-ocean"
                  >
                    닫기
                  </button>
                )}
              </div>
              {message && <p className="text-sm font-semibold text-slate-700">{message}</p>}
            </form>

            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <h2 className="text-lg font-black text-ink">동기화 상태</h2>
              <dl className="grid gap-2 md:grid-cols-2">
                <StatusInfo label="등록 키" value={access ? `${access.keyPrefix}...` : "미등록"} />
                <StatusInfo label="최근 동기화" value={syncState ? formatDateTime(syncState.syncedAt) : "아직 없음"} />
                <StatusInfo label="다음 자동 갱신" value={access ? formatDateTime(access.nextRecommendedSyncAt) : "키 등록 후 표시"} />
                <StatusInfo label="체험 종료" value={access ? formatDate(access.trialEndsAt) : "키 등록 후 표시"} />
              </dl>
              <p>
                앱에는 광고를 표시하지 않습니다. 단, 재생에 사용하는 YouTube 플레이어 자체 광고는 YouTube 정책과 계정 상태에 따라 노출될 수 있습니다.
              </p>
            </div>

            <DevicePinningNotice />
          </div>
        </section>
      ) : null}

      {!hasRegisteredKey ? (
        <section className="mx-auto grid max-w-3xl gap-3 px-4 py-14 text-center">
          <h2 className="text-2xl font-black text-ink">먼저 앱 키를 등록해 주세요.</h2>
          <p className="text-sm leading-6 text-slate-600">
            키가 등록되기 전에는 영상 목록을 보여주지 않습니다. 부모님이 승인한 콘텐츠만 앱으로 동기화됩니다.
          </p>
        </section>
      ) : !access?.canSync ? (
        <section className="mx-auto grid max-w-3xl gap-3 px-4 py-14 text-center">
          <h2 className="text-2xl font-black text-ink">{access?.label ?? "이용 상태 확인 필요"}</h2>
          <p className="text-sm leading-6 text-slate-600">
            무료 체험이 끝났거나 키가 비활성화되어 영상 카탈로그를 사용할 수 없습니다. 결제 연동은 웹 관리자 쪽에서 별도로 검토합니다.
          </p>
        </section>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 md:grid-cols-[minmax(0,1fr)_360px] md:px-6">
          <section className="grid gap-4">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-black shadow-sm">
              {activeVideo ? (
                <iframe
                  key={activeVideo.id}
                  src={buildEmbedUrl(activeVideo.youtubeVideoId)}
                  title={activeVideo.title}
                  className="aspect-video w-full"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="grid aspect-video place-items-center bg-slate-900 text-sm font-semibold text-white">
                  볼 수 있는 영상이 없습니다.
                </div>
              )}
            </div>

            {activeVideo && (
              <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-2">
                  <h2 className="break-words text-xl font-black text-ink">{activeVideo.title}</h2>
                  {activeVideo.description && <p className="text-sm leading-6 text-slate-600">{activeVideo.description}</p>}
                  <div className="flex flex-wrap gap-2">
                    {activeVideo.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-md px-2 py-1 text-xs font-black"
                        style={{ backgroundColor: `${tag.color ?? "#0369a1"}22`, color: tag.color ?? "#0369a1" }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {activeVideo.durationText && (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
                        {activeVideo.durationText}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => togglePlaylist(activeVideo)}
                    aria-pressed={playlist.some((item) => item.id === activeVideo.id)}
                    className={`rounded-md px-3 py-2 text-sm font-black ${
                      playlist.some((item) => item.id === activeVideo.id)
                        ? "bg-coral text-white"
                        : "border border-slate-300 bg-white text-slate-700 hover:border-coral"
                    }`}
                  >
                    {playlist.some((item) => item.id === activeVideo.id) ? "내 목록 담김" : "내 목록 담기"}
                  </button>
                  {KIDS_SIGNAL_OPTIONS.map((option) => (
                    <button
                      key={option.type}
                      type="button"
                      onClick={() => recordFeedback(activeVideo, option.type)}
                      aria-pressed={feedbackByVideoId[activeVideo.id] === option.type}
                      className={`rounded-md border px-3 py-2 text-sm font-black transition ${
                        feedbackByVideoId[activeVideo.id] === option.type
                          ? "border-ink bg-ink text-white"
                          : getFeedbackClassName(option.tone)
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="grid content-start gap-4">
            <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <label className="grid gap-1 text-sm font-black text-slate-700">
                제목/키워드 검색
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="예: 동물, 과학, 영어"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <TagButton active={!selectedTag} onClick={() => setSelectedTag("")}>전체</TagButton>
                {hotTags.map((tag) => (
                  <TagButton key={tag.slug} active={selectedTag === tag.slug} onClick={() => setSelectedTag(tag.slug)}>
                    {tag.name}
                  </TagButton>
                ))}
              </div>
            </section>

            {recommendedVideos.length > 0 && (
              <VideoRail title="부모님 최근추천" videos={recommendedVideos} activeVideoId={activeVideo?.id ?? null} onChoose={chooseVideo} />
            )}

            {playlist.length > 0 && (
              <VideoRail
                title="내 목록"
                videos={playlistToVideos(playlist, videos)}
                activeVideoId={activeVideo?.id ?? null}
                onChoose={chooseVideo}
              />
            )}

            <VideoRail title="영상 목록" videos={visibleVideos} activeVideoId={activeVideo?.id ?? null} onChoose={chooseVideo} />
          </aside>
        </div>
      )}
    </main>
  );
}

function VideoRail({
  title,
  videos,
  activeVideoId,
  onChoose,
}: {
  title: string;
  videos: AppCatalogVideo[];
  activeVideoId: string | null;
  onChoose: (videoId: string) => void;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-ink">{title}</h2>
        <span className="text-xs font-bold text-slate-500">{videos.length}개</span>
      </div>
      <div className="grid max-h-[520px] gap-2 overflow-y-auto pr-1">
        {videos.length === 0 && <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">표시할 영상이 없습니다.</p>}
        {videos.map((video) => (
          <button
            key={video.id}
            type="button"
            onClick={() => onChoose(video.id)}
            className={`grid grid-cols-[96px_1fr] gap-3 rounded-md border p-2 text-left transition ${
              activeVideoId === video.id ? "border-ink bg-slate-100" : "border-slate-200 bg-white hover:border-ocean"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnailUrl} alt="" className="aspect-video w-24 rounded-md object-cover" />
            <span className="grid min-w-0 content-center gap-1">
              <span className="line-clamp-2 break-words text-sm font-black text-ink">{video.title}</span>
              <span className="text-xs font-semibold text-slate-500">{video.durationText ?? "시간 미입력"}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TagButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-xs font-black ${
        active ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700 hover:border-ocean"
      }`}
    >
      {children}
    </button>
  );
}

function StatusInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function evaluateLocalAccess(access: AppSyncAccess): AppSyncAccess {
  if (access.status === "disabled") return { ...access, canSync: false, label: "비활성" };

  const now = Date.now();
  const paidUntilMs = access.paidUntil ? new Date(access.paidUntil).getTime() : 0;
  if (paidUntilMs > now) return { ...access, status: "paid", canSync: true, label: "이용 가능" };

  if (new Date(access.trialEndsAt).getTime() > now) {
    return { ...access, status: "trial", canSync: true, label: "무료 체험" };
  }

  return { ...access, status: "expired", canSync: false, label: "체험 종료" };
}

function filterVideos(videos: AppCatalogVideo[], query: string, selectedTag: string): AppCatalogVideo[] {
  const normalizedQuery = query.trim().toLowerCase();

  return videos.filter((video) => {
    const matchesTag = selectedTag ? video.tags.some((tag) => tag.slug === selectedTag) : true;
    const haystack = [video.title, video.description, video.searchKeywords, ...video.tags.map((tag) => tag.name)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = normalizedQuery ? haystack.includes(normalizedQuery) : true;

    return matchesTag && matchesQuery;
  });
}

function buildHotTags(videos: AppCatalogVideo[]): Array<{ slug: string; name: string; count: number }> {
  const counts = new Map<string, { slug: string; name: string; count: number }>();

  for (const video of videos) {
    for (const tag of video.tags) {
      const current = counts.get(tag.slug) ?? { slug: tag.slug, name: tag.name, count: 0 };
      current.count += 1;
      counts.set(tag.slug, current);
    }
  }

  return Array.from(counts.values())
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "ko-KR"))
    .slice(0, 12);
}

function playlistToVideos(playlist: KidsPlaylistItem[], videos: AppCatalogVideo[]): AppCatalogVideo[] {
  const videosById = new Map(videos.map((video) => [video.id, video]));
  return playlist.map((item) => videosById.get(item.id)).filter((video): video is AppCatalogVideo => Boolean(video));
}

function readCachedSync(): CachedAppSync | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(APP_SYNC_STORAGE_KEY) ?? "null") as CachedAppSync | null;
    if (!parsed?.access || !parsed.catalog || !Array.isArray(parsed.catalog.videos)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function shouldSync(cached: CachedAppSync | null): boolean {
  if (!cached) return true;
  return Date.now() - new Date(cached.syncedAt).getTime() >= DAILY_SYNC_MS;
}

function readPlaylist(): KidsPlaylistItem[] {
  try {
    return normalizeKidsPlaylist(JSON.parse(window.localStorage.getItem(KIDS_PLAYLIST_STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function writePlaylist(items: KidsPlaylistItem[]) {
  window.localStorage.setItem(KIDS_PLAYLIST_STORAGE_KEY, JSON.stringify(items));
}

function getOrCreateInstallationId(): string {
  const existing = window.localStorage.getItem(APP_INSTALLATION_ID_STORAGE_KEY);
  if (existing) return existing;

  const next = `install_${createRandomId()}`;
  window.localStorage.setItem(APP_INSTALLATION_ID_STORAGE_KEY, next);
  return next;
}

function createRandomId(): string {
  const browserCrypto = window.crypto;
  if (typeof browserCrypto.randomUUID === "function") {
    return browserCrypto.randomUUID().replace(/-/g, "");
  }

  const bytes = new Uint8Array(16);
  browserCrypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createParentChallenge(): ParentChallenge {
  return {
    left: 10 + Math.floor(Math.random() * 30),
    right: 10 + Math.floor(Math.random() * 30),
  };
}

function getAccessClassName(status: AppSyncAccess["status"]): string {
  switch (status) {
    case "disabled":
      return "bg-slate-100 text-slate-600";
    case "trial":
      return "bg-sky-100 text-sky-800";
    case "paid":
      return "bg-green-100 text-green-800";
    case "expired":
      return "bg-amber-100 text-amber-800";
  }
}

function getFeedbackClassName(tone: "positive" | "curious" | "soft" | "hard"): string {
  switch (tone) {
    case "positive":
      return "border-green-200 bg-green-50 text-green-800 hover:border-green-400";
    case "curious":
      return "border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-400";
    case "soft":
      return "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400";
    case "hard":
      return "border-slate-300 bg-white text-slate-700 hover:border-slate-500";
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}