"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { filterAppCatalogVideos } from "@/lib/app-video-filters";
import {
  APP_FALLBACK_VIDEOS,
  buildFallbackTags,
  filterFallbackVideos,
  type AppFallbackVideo,
} from "@/lib/app-fallback-catalog";
import { buildEmbedUrl } from "@/lib/youtube";

type AppSyncAccess = {
  status: "disabled" | "free";
  canSync: boolean;
  label: string;
  keyPrefix: string;
  lastSyncedAt: string | null;
  nextRecommendedSyncAt: string;
};

type AppPolicy = {
  wifiRequired: boolean;
};

type AppPolicyResponse = {
  ok: true;
  policy: AppPolicy;
};

type AppSyncResponse =
  | {
      ok: true;
      message: string;
      access: AppSyncAccess;
      policy: AppPolicy;
      catalog: AppCatalog | null;
    }
  | {
      ok: false;
      message: string;
    };

type CachedAppSync = {
  access: AppSyncAccess;
  catalog: AppCatalog;
  policy?: AppPolicy;
  syncedAt: string;
};

type ParentChallenge = {
  left: number;
  right: number;
};

const APP_KEY_STORAGE_KEY = "sontube:app-access-key";
const APP_INSTALLATION_ID_STORAGE_KEY = "sontube:app-installation-id";
const APP_SYNC_STORAGE_KEY = "sontube:app-catalog-cache";
const EMPTY_APP_VIDEOS: AppCatalogVideo[] = [];
const DEFAULT_WIFI_REQUIRED = true;
const NETWORK_CHECK_TIMEOUT_MS = 5_000;

export function AppShell() {
  const [isReady, setIsReady] = useState(false);
  const [savedKey, setSavedKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [syncState, setSyncState] = useState<CachedAppSync | null>(null);
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<KidsPlaylistItem[]>([]);
  const [feedbackByVideoId, setFeedbackByVideoId] = useState<Record<string, KidsFeedbackSignalType>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [parentGateOpen, setParentGateOpen] = useState(false);
  const [parentChallenge, setParentChallenge] = useState<ParentChallenge>(() => createParentChallenge());
  const [parentAnswer, setParentAnswer] = useState("");
  const [parentGateError, setParentGateError] = useState("");
  const [showConnectionSamples, setShowConnectionSamples] = useState(false);
  const syncInFlightRef = useRef<Promise<boolean> | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const parentAnswerRef = useRef<HTMLInputElement>(null);
  const appKeyInputRef = useRef<HTMLInputElement>(null);

  const syncWithKey = useCallback(
    async (
      key: string,
      options: { endpoint?: string; replaceStoredKey?: boolean } = {},
    ): Promise<boolean> => {
      if (syncInFlightRef.current) return syncInFlightRef.current;

      const task = (async () => {
        const trimmedKey = key.trim();
        const currentInstallationId = getOrCreateInstallationId();

        if (!trimmedKey) {
          setMessageTone("error");
          setMessage("관리자 화면에서 만든 앱 키를 먼저 등록해 주세요.");
          return false;
        }

        setIsSyncing(true);
        setMessageTone("info");
        setMessage("");

        try {
          const policy = await fetchAppPolicy(currentInstallationId);
          if (policy.wifiRequired && !isRequiredNetworkAvailable()) {
            setShowConnectionSamples(true);
            setMessageTone("error");
            setMessage("Wi-Fi 연결을 확인할 수 없어 샘플 목록만 보여줍니다.");
            return false;
          }

          const previousCache = readCachedSync();
          const response = await fetchWithTimeout(options.endpoint ?? "/api/app/sync", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              key: trimmedKey,
              installationId: currentInstallationId,
              catalogVersion: previousCache?.catalog.version,
            }),
          });
          const data = (await response.json()) as AppSyncResponse;

          if (!response.ok || !data.ok) {
            if (!options.replaceStoredKey || response.status >= 500) setShowConnectionSamples(true);
            setMessageTone("error");
            setMessage(data.message || "동기화에 실패했습니다.");
            return false;
          }

          if (!data.access.canSync) {
            if (!options.replaceStoredKey) setShowConnectionSamples(true);
            setMessageTone("error");
            setMessage("사용할 수 없는 앱 키입니다.");
            return false;
          }

          const previousCatalog = previousCache?.catalog ?? null;
          const nextCatalog = data.catalog ?? previousCatalog;
          if (!nextCatalog) {
            setShowConnectionSamples(true);
            setMessageTone("error");
            setMessage("저장된 목록이 없어 샘플 목록만 보여줍니다.");
            return false;
          }

          const cached: CachedAppSync = {
            access: data.access,
            policy: data.policy,
            catalog: nextCatalog,
            syncedAt: new Date().toISOString(),
          };

          if (options.replaceStoredKey) {
            window.localStorage.setItem(APP_KEY_STORAGE_KEY, trimmedKey);
            setSavedKey(trimmedKey);
            setKeyInput("");
          }
          window.localStorage.setItem(APP_SYNC_STORAGE_KEY, JSON.stringify(cached));
          setSyncState(cached);
          setShowConnectionSamples(false);
          setSelectedChannelId((current) =>
            current && nextCatalog.videos.some((video) => video.channel?.id === current) ? current : null,
          );
          setActiveVideoId((current) =>
            nextCatalog.videos.some((video) => video.id === current) ? current : nextCatalog.videos[0]?.id ?? null,
          );
          setMessageTone("info");
          setMessage(data.message);
          return true;
        } catch (error) {
          setShowConnectionSamples(true);
          const detail =
            error instanceof Error && error.name === "AbortError"
              ? "연결 확인 시간이 초과되었습니다."
              : "서버에 연결하지 못했습니다.";
          setMessageTone("error");
          setMessage(`${detail} 샘플 목록만 보여줍니다.`);
          return false;
        } finally {
          setIsSyncing(false);
        }
      })();

      syncInFlightRef.current = task;
      try {
        return await task;
      } finally {
        syncInFlightRef.current = null;
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

    if (!key) {
      setIsReady(true);
      return;
    }

    void syncWithKey(key).finally(() => setIsReady(true));
  }, [syncWithKey]);

  useEffect(() => {
    if (!isReady || !savedKey) return;

    const checkOnReturn = () => {
      if (document.visibilityState === "visible") void syncWithKey(savedKey);
    };

    const appWindow = window as Window & { SonTubeCheckForUpdates?: () => void };
    appWindow.SonTubeCheckForUpdates = checkOnReturn;

    document.addEventListener("visibilitychange", checkOnReturn);
    window.addEventListener("focus", checkOnReturn);
    return () => {
      if (appWindow.SonTubeCheckForUpdates === checkOnReturn) delete appWindow.SonTubeCheckForUpdates;
      document.removeEventListener("visibilitychange", checkOnReturn);
      window.removeEventListener("focus", checkOnReturn);
    };
  }, [isReady, savedKey, syncWithKey]);

  useEffect(() => {
    if (!isReady || !savedKey) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let delay = 300_000;
    const check = async () => {
      if (document.visibilityState === "visible") {
        const ok = await syncWithKey(savedKey);
        delay = ok ? 300_000 : Math.min(delay * 2, 1_800_000);
      }
      if (!cancelled) timer = setTimeout(check, delay);
    };
    timer = setTimeout(check, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isReady, savedKey, syncWithKey]);

  useEffect(() => {
    if (parentGateOpen) parentAnswerRef.current?.focus({ preventScroll: true });
  }, [parentGateOpen, parentChallenge]);

  useEffect(() => {
    if (settingsOpen && savedKey) appKeyInputRef.current?.focus({ preventScroll: true });
  }, [savedKey, settingsOpen]);

  const cachedAccess = syncState?.access ?? null;
  const access = useMemo(() => (cachedAccess ? evaluateLocalAccess(cachedAccess) : null), [cachedAccess]);
  const videos = useMemo(() => (access?.canSync ? syncState?.catalog.videos ?? EMPTY_APP_VIDEOS : EMPTY_APP_VIDEOS), [access, syncState]);
  const visibleVideos = useMemo(
    () => filterAppCatalogVideos(videos, query, selectedTag, selectedChannelId),
    [videos, query, selectedTag, selectedChannelId],
  );
  const recommendedVideos = useMemo(() => videos.filter((video) => video.isParentRecommended).slice(0, 8), [videos]);
  const hotTags = useMemo(() => buildHotTags(videos), [videos]);
  const fallbackVideos = useMemo(
    () => filterFallbackVideos(APP_FALLBACK_VIDEOS, query, selectedTag),
    [query, selectedTag],
  );
  const fallbackTags = useMemo(() => buildFallbackTags(APP_FALLBACK_VIDEOS), []);
  const activeVideo = videos.find((video) => video.id === activeVideoId) ?? visibleVideos[0] ?? null;
  const selectedChannel = selectedChannelId
    ? videos.find((video) => video.channel?.id === selectedChannelId)?.channel ?? null
    : null;
  const activeChannelVideoCount = activeVideo?.channel
    ? videos.filter((video) => video.channel?.id === activeVideo.channel?.id).length
    : 0;
  const hasRegisteredKey = Boolean(savedKey);
  const isInitialSetup = !hasRegisteredKey;

  function submitKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void syncWithKey(keyInput, { endpoint: "/api/app/register", replaceStoredKey: true });
  }

  function chooseVideo(videoId: string) {
    setActiveVideoId(videoId);
  }

  function showActiveChannelVideos() {
    if (!activeVideo?.channel || activeChannelVideoCount < 2) return;

    setQuery("");
    setSelectedTag("");
    setSelectedChannelId(activeVideo.channel.id);
  }

  function showAllVideos() {
    setSelectedChannelId(null);
  }

  function requestSettings() {
    if (isInitialSetup) {
      appKeyInputRef.current?.focus({ preventScroll: true });
      return;
    }

    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }

    setParentChallenge(createParentChallenge());
    setParentAnswer("");
    setParentGateError("");
    setParentGateOpen(true);
  }

  function closeParentGate() {
    setParentGateOpen(false);
    window.requestAnimationFrame(() => settingsButtonRef.current?.focus({ preventScroll: true }));
  }

  function closeSettings() {
    setSettingsOpen(false);
    window.requestAnimationFrame(() => settingsButtonRef.current?.focus({ preventScroll: true }));
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
      appKey: savedKey,
      installationId: getOrCreateInstallationId(),
      type: "PLAYLIST",
      active: !isSaved,
    });
  }

  function recordFeedback(video: AppCatalogVideo, type: KidsFeedbackSignalType) {
    setFeedbackByVideoId((current) => ({ ...current, [video.id]: type }));
    void recordKidsSignalAction({
      videoId: video.id,
      clientKey: getKidsClientKey(),
      appKey: savedKey,
      installationId: getOrCreateInstallationId(),
      type,
      active: true,
    });
  }

  if (!isReady) {
    return (
      <main
        className="grid min-h-[100dvh] place-items-center bg-slate-50 px-4"
        aria-busy="true"
        aria-label="SonTube 앱 준비 중"
      >
        <div className="w-full max-w-sm" role="status" aria-live="polite">
          <p className="text-sm font-black text-ink">안전 영상서랍을 준비하고 있어요</p>
          <div className="mt-3 grid gap-2" aria-hidden="true">
            <span className="h-3 w-3/4 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
            <span className="h-3 w-1/2 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-bold text-ocean">SonTube App</p>
            <h1 className="text-2xl font-black text-ink md:text-3xl">안전 영상서랍</h1>
          </div>
          <div className="flex items-center gap-2">
            {showConnectionSamples && (
              <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">샘플 화면</span>
            )}
            <button
              ref={settingsButtonRef}
              type="button"
              onClick={requestSettings}
              aria-label="설정"
              aria-expanded={settingsOpen || parentGateOpen || isInitialSetup}
              aria-controls={
                parentGateOpen
                  ? "parent-gate-region"
                  : settingsOpen || isInitialSetup
                    ? "parent-settings-region"
                    : undefined
              }
              title="설정"
              className="grid h-11 w-11 place-items-center rounded-full text-slate-500 opacity-40 transition hover:bg-slate-100 hover:opacity-80 active:scale-[0.98] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.7">
                <path d="M9.6 3.4h4.8l.5 2a7.5 7.5 0 0 1 1.4.8l2-.6 2.4 4.1-1.5 1.4a7 7 0 0 1 0 1.8l1.5 1.4-2.4 4.1-2-.6a7.5 7.5 0 0 1-1.4.8l-.5 2H9.6l-.5-2a7.5 7.5 0 0 1-1.4-.8l-2 .6-2.4-4.1 1.5-1.4a7 7 0 0 1 0-1.8L3.3 9.7l2.4-4.1 2 .6a7.5 7.5 0 0 1 1.4-.8l.5-2Z" />
                <circle cx="12" cy="12" r="2.6" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {parentGateOpen && (
        <section id="parent-gate-region" aria-labelledby="parent-gate-title" className="border-b border-slate-200 bg-white px-4 py-4 md:px-6">
          <form onSubmit={submitParentGate} className="mx-auto grid max-w-lg gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <h2 id="parent-gate-title" className="text-lg font-black text-ink">부모님 확인</h2>
              <p className="mt-1 text-sm text-slate-600">설정 화면을 열려면 간단한 확인을 완료해 주세요.</p>
            </div>
            <label className="grid gap-1 text-sm font-black text-slate-700">
              {parentChallenge.left} + {parentChallenge.right} = ?
              <input
                ref={parentAnswerRef}
                id="parent-answer"
                name="parentAnswer"
                value={parentAnswer}
                onChange={(event) => setParentAnswer(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                enterKeyHint="done"
                required
                aria-invalid={parentGateError ? true : undefined}
                aria-describedby={parentGateError ? "parent-gate-error" : undefined}
                className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
              />
            </label>
            {parentGateError && <p id="parent-gate-error" className="text-sm font-semibold text-red-700" role="alert">{parentGateError}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="min-h-11 rounded-md bg-ink px-4 py-2 text-sm font-black text-white hover:bg-slate-700">
                확인
              </button>
                <button
                  type="button"
                  onClick={closeParentGate}
                className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-ocean hover:text-ocean"
              >
                닫기
              </button>
            </div>
          </form>
        </section>
      )}

      {settingsOpen || isInitialSetup ? (
        <section id="parent-settings-region" aria-labelledby="app-key-settings-title" className="border-b border-slate-200 bg-white px-4 py-5 md:px-6">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[1fr_1fr]">
            <form onSubmit={submitKey} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <h2 id="app-key-settings-title" className="text-lg font-black text-ink">앱 키 등록</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  부모님 관리자 화면의 앱 키 메뉴에서 만든 키를 확인합니다. 서버가 정상 승인한 뒤에만 기존 키와 목록을 교체합니다.
                </p>
              </div>
              <label htmlFor="app-key-input" className="text-sm font-black text-slate-700">
                {hasRegisteredKey ? "교체할 새 앱 키" : "앱 키"}
              </label>
              <input
                ref={appKeyInputRef}
                id="app-key-input"
                name="appKey"
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                placeholder={hasRegisteredKey ? "새 키로 교체하려면 입력" : "st_app_..."}
                type="password"
                autoComplete="off"
                spellCheck={false}
                aria-label={hasRegisteredKey ? "교체할 새 앱 키" : "앱 키"}
                aria-describedby={message ? "app-key-message" : undefined}
                className="rounded-md border border-slate-300 px-3 py-3 font-mono text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
              />
              {hasRegisteredKey && <p className="text-xs font-semibold text-slate-500">등록된 키: {access?.keyPrefix ?? "st_app_..."}...</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isSyncing || !keyInput.trim()}
                  aria-busy={isSyncing}
                  className="min-h-11 rounded-md bg-ink px-4 py-2 text-sm font-black text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {hasRegisteredKey ? "새 키 확인 후 교체" : "등록하고 불러오기"}
                </button>
                {hasRegisteredKey && (
                  <button
                    type="button"
                    onClick={closeSettings}
                    className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-ocean hover:text-ocean"
                  >
                    닫기
                  </button>
                )}
              </div>
              {message && (
                <p
                  id="app-key-message"
                  className={`text-sm font-semibold ${messageTone === "error" ? "text-red-700" : "text-slate-700"}`}
                  role={messageTone === "error" ? "alert" : "status"}
                  aria-live={messageTone === "error" ? "assertive" : "polite"}
                  aria-atomic="true"
                >
                  {message}
                </p>
              )}
            </form>

            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <h2 className="text-lg font-black text-ink">동기화 상태</h2>
              <dl className="grid gap-2 md:grid-cols-2">
                <StatusInfo label="등록 키" value={access ? `${access.keyPrefix}...` : "미등록"} />
                <StatusInfo label="최근 목록 확인" value={syncState ? formatDateTime(syncState.syncedAt) : "아직 없음"} />
                <StatusInfo label="확인 시점" value="앱 시작·복귀마다" />
                <StatusInfo
                  label="목록 수신 환경"
                  value={(syncState?.policy?.wifiRequired ?? DEFAULT_WIFI_REQUIRED) ? "Wi-Fi만" : "Wi-Fi + 모바일 데이터"}
                />
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
      ) : showConnectionSamples ? (
        <OfflineSampleCatalog
          videos={fallbackVideos}
          tags={fallbackTags}
          query={query}
          selectedTag={selectedTag}
          message={message}
          isChecking={isSyncing}
          onQueryChange={setQuery}
          onTagChange={setSelectedTag}
          onRetry={() => void syncWithKey(savedKey)}
        />
      ) : !access?.canSync ? (
        <section className="mx-auto grid max-w-3xl gap-3 px-4 py-14 text-center">
          <h2 className="text-2xl font-black text-ink">이용 상태 확인 필요</h2>
          <p className="text-sm leading-6 text-slate-600">
            이용 기간이 끝났거나 키가 비활성화되어 영상 카탈로그를 사용할 수 없습니다. 부모님 관리자 화면에서 상태를 확인해 주세요.
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
                  title={`${activeVideo.title} YouTube 플레이어`}
                  className="aspect-video w-full"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
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
                  {activeVideo.channel && (
                    <p className="text-xs font-bold text-slate-500">{activeVideo.channel.name}</p>
                  )}
                  {activeVideo.description && <p className="break-words text-sm leading-6 text-slate-600">{activeVideo.description}</p>}
                  <div className="flex flex-wrap gap-2">
                    {activeVideo.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-md px-2 py-1 text-xs font-black"
                        style={{ backgroundColor: `${tag.color ?? "#0369a1"}22`, color: "#334155" }}
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
                  {activeVideo.channel && activeChannelVideoCount >= 2 && (
                    <button
                      type="button"
                      onClick={
                        selectedChannelId === activeVideo.channel.id ? showAllVideos : showActiveChannelVideos
                      }
                      className="inline-flex min-h-11 w-fit items-center rounded-md bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      {selectedChannelId === activeVideo.channel.id
                        ? "전체 목록으로"
                        : `같은 채널의 승인 영상 ${activeChannelVideoCount}개`}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => togglePlaylist(activeVideo)}
                    aria-pressed={playlist.some((item) => item.id === activeVideo.id)}
                    className={`min-h-11 rounded-md px-3 py-2 text-sm font-black ${
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
                      className={`min-h-11 rounded-md border px-3 py-2 text-sm font-black transition ${
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
                  type="search"
                  name="catalogQuery"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="예: 동물, 과학, 영어"
                  autoComplete="off"
                  enterKeyHint="search"
                  className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
                />
              </label>
              {selectedChannel && (
                <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
                  <span className="min-w-0 truncate text-xs font-bold text-slate-600">
                    {selectedChannel.name} 승인 영상만 보는 중
                  </span>
                  <button
                    type="button"
                    onClick={showAllVideos}
                    className="inline-flex min-h-11 shrink-0 items-center text-xs font-black text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
                  >
                    전체 목록으로
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <TagButton active={!selectedTag} onClick={() => setSelectedTag("")}>전체</TagButton>
                {hotTags.map((tag) => (
                  <TagButton key={tag.slug} active={selectedTag === tag.slug} onClick={() => setSelectedTag(tag.slug)}>
                    {tag.name}
                  </TagButton>
                ))}
              </div>
            </section>

            {!selectedChannel && recommendedVideos.length > 0 && (
              <VideoRail title="부모님 최근추천" videos={recommendedVideos} activeVideoId={activeVideo?.id ?? null} onChoose={chooseVideo} />
            )}

            {!selectedChannel && playlist.length > 0 && (
              <VideoRail
                title="내 목록"
                videos={playlistToVideos(playlist, videos)}
                activeVideoId={activeVideo?.id ?? null}
                onChoose={chooseVideo}
              />
            )}

            <VideoRail
              title={selectedChannel ? `${selectedChannel.name} 승인 영상` : "영상 목록"}
              videos={visibleVideos}
              activeVideoId={activeVideo?.id ?? null}
              onChoose={chooseVideo}
            />
          </aside>
        </div>
      )}
    </main>
  );
}

function OfflineSampleCatalog({
  videos,
  tags,
  query,
  selectedTag,
  message,
  isChecking,
  onQueryChange,
  onTagChange,
  onRetry,
}: {
  videos: AppFallbackVideo[];
  tags: Array<{ name: string; slug: string }>;
  query: string;
  selectedTag: string;
  message: string;
  isChecking: boolean;
  onQueryChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onRetry: () => void;
}) {
  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5 md:px-6">
      <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs font-black text-amber-700">연결 전 샘플 화면</p>
          <h2 className="mt-1 text-xl font-black text-ink">실제 승인 목록은 숨겨 두었어요</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            지정된 통신 환경을 확인하지 못해 검색·태그·카드 배치 검수용 샘플만 표시합니다. 이 카드는 재생되지 않습니다.
          </p>
          {message && <p className="mt-2 text-sm font-semibold text-amber-800" role="alert" aria-live="assertive" aria-atomic="true">{message}</p>}
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={isChecking}
          className="min-h-11 rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-black text-amber-800 hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isChecking ? "연결 확인 중" : "연결 다시 확인"}
        </button>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="grid gap-1 text-sm font-black text-slate-700">
          샘플 제목/키워드 검색
          <input
            type="search"
            name="sampleQuery"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="예: 동물, 과학, 영어"
            autoComplete="off"
            enterKeyHint="search"
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <TagButton active={!selectedTag} onClick={() => onTagChange("")}>전체</TagButton>
          {tags.map((tag) => (
            <TagButton key={tag.slug} active={selectedTag === tag.slug} onClick={() => onTagChange(tag.slug)}>
              {tag.name}
            </TagButton>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-ink">화면 검수용 샘플</h2>
        <span className="text-xs font-bold text-slate-500">{videos.length}개</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {videos.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 sm:col-span-2 lg:col-span-3" role="status">
            조건에 맞는 샘플이 없습니다.
          </p>
        )}
        {videos.map((video) => (
          <article key={video.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid aspect-video place-items-center text-5xl" style={{ backgroundColor: video.accent }} aria-hidden="true">
              {video.emoji}
            </div>
            <div className="grid gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-black text-ink">{video.title}</h3>
                <span className="shrink-0 text-xs font-bold text-slate-500">{video.durationText}</span>
              </div>
              <p className="text-xs font-bold text-slate-500">{video.channel.name}</p>
              <p className="text-sm leading-6 text-slate-600">{video.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {video.tags.map((tag) => (
                  <span key={tag.slug} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
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
      <div className="grid max-h-[520px] gap-2 overflow-y-auto overscroll-contain pr-1">
        {videos.length === 0 && <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-sm text-slate-500" role="status">표시할 영상이 없습니다.</p>}
        {videos.map((video) => (
          <button
            key={video.id}
            type="button"
            onClick={() => onChoose(video.id)}
            aria-pressed={activeVideoId === video.id}
            aria-label={`${video.title} 재생`}
            className={`grid min-h-11 grid-cols-[96px_1fr] gap-3 rounded-md border p-2 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none ${
              activeVideoId === video.id ? "border-ink bg-slate-100" : "border-slate-200 bg-white hover:border-ocean"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnailUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="aspect-video w-24 rounded-md object-cover"
            />
            <span className="grid min-w-0 content-center gap-1">
              <span className="line-clamp-2 break-words text-sm font-black text-ink">{video.title}</span>
              {video.channel && (
                <span className="truncate text-xs font-semibold text-slate-500">{video.channel.name}</span>
              )}
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
      aria-pressed={active}
      className={`min-h-11 rounded-md border px-3 py-2 text-xs font-black transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none ${
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
  // Old cached entitlements are not upgraded locally; a successful server sync is required.
  return { ...access, canSync: access.status === "free" && access.canSync };
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

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), NETWORK_CHECK_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchAppPolicy(installationId: string): Promise<AppPolicy> {
  const query = new URLSearchParams({ installationId });
  const response = await fetchWithTimeout(`/api/app/policy?${query.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("앱 통신 설정을 확인하지 못했습니다.");

  const data = (await response.json()) as Partial<AppPolicyResponse>;
  return {
    wifiRequired:
      data.ok === true && typeof data.policy?.wifiRequired === "boolean"
        ? data.policy.wifiRequired
        : DEFAULT_WIFI_REQUIRED,
  };
}

function isRequiredNetworkAvailable(): boolean {
  const bridge = (window as Window & { SonTubeNetwork?: { isWifiConnected: () => boolean } }).SonTubeNetwork;
  if (bridge) {
    try {
      return bridge.isWifiConnected();
    } catch {
      return false;
    }
  }

  return navigator.onLine;
}

function readCachedSync(): CachedAppSync | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(APP_SYNC_STORAGE_KEY) ?? "null") as CachedAppSync | null;
    if (!parsed?.access || !parsed.catalog || !Array.isArray(parsed.catalog.videos)) return null;
    return {
      ...parsed,
      catalog: {
        ...parsed.catalog,
        videos: parsed.catalog.videos.map((video) => ({
          ...video,
          channel: normalizeCachedChannel((video as unknown as { channel?: unknown }).channel),
        })),
      },
    };
  } catch {
    return null;
  }
}

function normalizeCachedChannel(value: unknown): AppCatalogVideo["channel"] {
  if (!value || typeof value !== "object") return null;

  const candidate = value as { id?: unknown; name?: unknown };
  if (typeof candidate.id !== "string" || typeof candidate.name !== "string") return null;
  if (!candidate.id.trim() || !candidate.name.trim()) return null;

  return { id: candidate.id, name: candidate.name };
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
  const nativeBridge = (
    window as Window & { SonTubeDevice?: { getInstallationId: () => string } }
  ).SonTubeDevice;
  if (nativeBridge) {
    try {
      const nativeId = nativeBridge.getInstallationId();
      if (/^[a-zA-Z0-9:_-]{16,120}$/.test(nativeId)) {
        window.localStorage.setItem(APP_INSTALLATION_ID_STORAGE_KEY, nativeId);
        return nativeId;
      }
    } catch {
      // Fall through to a browser-local installation identifier.
    }
  }

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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
