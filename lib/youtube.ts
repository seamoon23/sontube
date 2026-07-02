export type YouTubeUrlKind = "watch" | "short" | "embed" | "shorts";

export type ParseYouTubeVideoIdResult =
  | {
      ok: true;
      videoId: string;
      kind: YouTubeUrlKind;
    }
  | {
      ok: false;
      reason:
        | "invalid_url"
        | "not_youtube_url"
        | "channel_not_supported"
        | "playlist_not_supported"
        | "search_not_supported"
        | "missing_video_id";
      message: string;
    };

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export function parseYouTubeVideoId(rawUrl: string): ParseYouTubeVideoIdResult {
  let url: URL;

  try {
    url = new URL(rawUrl.trim());
  } catch {
    return {
      ok: false,
      reason: "invalid_url",
      message: "올바른 URL 형식이 아닙니다.",
    };
  }

  const hostname = url.hostname.toLowerCase();
  const pathname = stripTrailingSlash(url.pathname);

  if (hostname === "youtu.be") {
    return parseCandidate(pathname.slice(1).split("/")[0], "short");
  }

  if (!YOUTUBE_HOSTS.has(hostname)) {
    return {
      ok: false,
      reason: "not_youtube_url",
      message: "YouTube 영상 URL만 등록할 수 있습니다.",
    };
  }

  if (
    pathname.startsWith("/@") ||
    pathname.startsWith("/channel/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/user/")
  ) {
    return {
      ok: false,
      reason: "channel_not_supported",
      message: "채널 URL은 MVP에서 등록할 수 없습니다. 개별 영상 URL을 입력해 주세요.",
    };
  }

  if (pathname.startsWith("/playlist")) {
    return {
      ok: false,
      reason: "playlist_not_supported",
      message: "플레이리스트 자동 가져오기는 지원하지 않습니다. 개별 영상 URL을 입력해 주세요.",
    };
  }

  if (pathname.startsWith("/results")) {
    return {
      ok: false,
      reason: "search_not_supported",
      message: "YouTube 전체 검색 URL은 등록할 수 없습니다.",
    };
  }

  if (pathname === "/watch") {
    return parseCandidate(url.searchParams.get("v"), "watch");
  }

  if (pathname.startsWith("/embed/")) {
    return parseCandidate(pathname.split("/")[2], "embed");
  }

  if (pathname.startsWith("/shorts/")) {
    return parseCandidate(pathname.split("/")[2], "shorts");
  }

  return {
    ok: false,
    reason: "missing_video_id",
    message: "지원하는 YouTube 영상 URL에서 videoId를 찾을 수 없습니다.",
  };
}

export function buildEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function buildYouTubeThumbnailUrl(videoId: string, quality = "hqdefault"): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

function parseCandidate(
  candidate: string | null | undefined,
  kind: YouTubeUrlKind,
): ParseYouTubeVideoIdResult {
  if (!candidate || !VIDEO_ID_PATTERN.test(candidate)) {
    return {
      ok: false,
      reason: "missing_video_id",
      message: "지원하는 YouTube 영상 URL에서 videoId를 찾을 수 없습니다.",
    };
  }

  return {
    ok: true,
    videoId: candidate,
    kind,
  };
}

function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}
