import { describe, expect, it } from "vitest";
import {
  buildEmbedUrl,
  buildYouTubeThumbnailUrl,
  parseYouTubeVideoId,
} from "@/lib/youtube";

describe("parseYouTubeVideoId", () => {
  it("extracts video IDs from supported YouTube URL formats", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      ok: true,
      videoId: "dQw4w9WgXcQ",
      kind: "watch",
    });
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=10")).toEqual({
      ok: true,
      videoId: "dQw4w9WgXcQ",
      kind: "short",
    });
    expect(parseYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toEqual({
      ok: true,
      videoId: "dQw4w9WgXcQ",
      kind: "embed",
    });
    expect(parseYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toEqual({
      ok: true,
      videoId: "dQw4w9WgXcQ",
      kind: "shorts",
    });
  });

  it("rejects channel, playlist, search, malformed, and non-YouTube URLs", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/@some-channel")).toMatchObject({
      ok: false,
      reason: "channel_not_supported",
    });
    expect(parseYouTubeVideoId("https://www.youtube.com/playlist?list=PL123")).toMatchObject({
      ok: false,
      reason: "playlist_not_supported",
    });
    expect(parseYouTubeVideoId("https://www.youtube.com/results?search_query=cats")).toMatchObject({
      ok: false,
      reason: "search_not_supported",
    });
    expect(parseYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toMatchObject({
      ok: false,
      reason: "not_youtube_url",
    });
    expect(parseYouTubeVideoId("not a url")).toMatchObject({
      ok: false,
      reason: "invalid_url",
    });
  });
});

describe("YouTube URL builders", () => {
  it("builds iframe and default thumbnail URLs without external API calls", () => {
    expect(buildEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1",
    );
    expect(buildYouTubeThumbnailUrl("dQw4w9WgXcQ")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });
});
