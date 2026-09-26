import { describe, expect, it } from "vitest";
import type { AppCatalogVideo } from "@/lib/app-catalog";
import {
  buildLiteChannelFacets,
  buildLiteTagFacets,
  filterLiteVideos,
  MAX_LITE_PLAYLIST_ITEMS,
  normalizeLitePlaylist,
  readLiteCatalogResponse,
  toggleLitePlaylist,
} from "@/components/lite/lite-model";

const videos: AppCatalogVideo[] = [
  {
    id: "video-animals",
    youtubeVideoId: "dQw4w9WgXcQ",
    title: "차분한 동물 이야기",
    description: "동물의 생활을 살펴봐요.",
    searchKeywords: "강아지 고양이 자연",
    durationText: "4:12",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    isParentRecommended: false,
    parentRecommendedAt: null,
    updatedAt: "2026-08-30T00:00:00.000Z",
    channel: { id: "channel-nature", name: "자연 교실" },
    tags: [{ id: "tag-animals", name: "동물", slug: "animals", color: null, icon: null }],
  },
  {
    id: "video-space",
    youtubeVideoId: "M7lc1UVf-VE",
    title: "우주를 관찰해요",
    description: null,
    searchKeywords: "별 행성 과학",
    durationText: null,
    thumbnailUrl: "https://img.youtube.com/vi/M7lc1UVf-VE/hqdefault.jpg",
    isParentRecommended: false,
    parentRecommendedAt: null,
    updatedAt: "2026-08-30T00:00:00.000Z",
    channel: { id: "channel-science", name: "호기심 과학" },
    tags: [{ id: "tag-science", name: "과학", slug: "science", color: null, icon: null }],
  },
];

const validCatalog = {
  source: "LIVE",
  generatedAt: "2026-08-30T00:00:00.000Z",
  version: "0123456789abcdef01234567",
  videos,
};

describe("Lite viewer model", () => {
  it("accepts the public contract, including an intentionally empty catalog", () => {
    const emptyCatalog = { ...validCatalog, videos: [] };
    expect(readLiteCatalogResponse({ ok: true, catalog: emptyCatalog })).toEqual(emptyCatalog);
    expect(readLiteCatalogResponse({ ok: true, catalog: validCatalog })).toEqual(validCatalog);
    expect(readLiteCatalogResponse({ ok: true, catalog: { source: "FALLBACK", generatedAt: "", version: "", videos: [] } })).toBeNull();
    expect(readLiteCatalogResponse({ ok: true, catalog: { videos: [{ id: "private-fallback" }] } })).toBeNull();
    expect(readLiteCatalogResponse({ ok: false, catalog: { generatedAt: "", version: "", videos: [] } })).toBeNull();
  });

  it("rejects malformed version, timestamps, IDs, and additional contract fields", () => {
    expect(readLiteCatalogResponse({ ok: true, catalog: { ...validCatalog, version: "0123456789ABCDEF01234567" } })).toBeNull();
    expect(readLiteCatalogResponse({ ok: true, catalog: { ...validCatalog, version: "0123456789abcdef0123456" } })).toBeNull();
    expect(readLiteCatalogResponse({ ok: true, catalog: { ...validCatalog, generatedAt: "2026-02-30T00:00:00.000Z" } })).toBeNull();
    expect(readLiteCatalogResponse({ ok: true, catalog: { ...validCatalog, videos: [{ ...videos[0], youtubeVideoId: "too-short" }] } })).toBeNull();
    expect(readLiteCatalogResponse({ ok: true, catalog: { ...validCatalog, videos: [{ ...videos[0], updatedAt: "not-a-date" }] } })).toBeNull();
    expect(readLiteCatalogResponse({ ok: true, catalog: { ...validCatalog, internalFamilyId: "private" } })).toBeNull();
  });

  it("filters only the received public list by parent keywords, tags, and channel", () => {
    expect(filterLiteVideos(videos, "고양이", "", null).map((video) => video.id)).toEqual(["video-animals"]);
    expect(filterLiteVideos(videos, "", "science", null).map((video) => video.id)).toEqual(["video-space"]);
    expect(filterLiteVideos(videos, "", "", "channel-nature").map((video) => video.id)).toEqual(["video-animals"]);
    expect(filterLiteVideos(videos, "없는 영상", "", null)).toEqual([]);
  });

  it("builds stable tag and channel facets from received videos", () => {
    expect(buildLiteTagFacets(videos)).toEqual([
      { slug: "science", name: "과학", count: 1 },
      { slug: "animals", name: "동물", count: 1 },
    ]);
    expect(buildLiteChannelFacets(videos)).toEqual([
      { id: "channel-nature", name: "자연 교실", count: 1 },
      { id: "channel-science", name: "호기심 과학", count: 1 },
    ]);
  });

  it("keeps a unique bounded playlist suitable for localStorage", () => {
    expect(normalizeLitePlaylist(["video-1", "video-1", "", 3, "video-2"])).toEqual(["video-1", "video-2"]);
    expect(toggleLitePlaylist(["video-1"], "video-1")).toEqual([]);
    expect(toggleLitePlaylist([], "video-2")).toEqual(["video-2"]);
    const tooMany = Array.from({ length: MAX_LITE_PLAYLIST_ITEMS + 5 }, (_, index) => `video-${index}`);
    expect(normalizeLitePlaylist(tooMany)).toHaveLength(MAX_LITE_PLAYLIST_ITEMS);
    const full = normalizeLitePlaylist(tooMany);
    expect(toggleLitePlaylist(full, "one-more-video")).toEqual(full);
  });
});
