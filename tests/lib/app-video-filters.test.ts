import { describe, expect, it } from "vitest";
import type { AppCatalogVideo } from "@/lib/app-catalog";
import { filterAppCatalogVideos } from "@/lib/app-video-filters";

const videos: AppCatalogVideo[] = [
  {
    id: "video-1",
    youtubeVideoId: "abcdefghijk",
    title: "신나는 동물 탐험",
    description: "관리자 메모에만 있는 비밀단어",
    searchKeywords: "사자 코끼리",
    durationText: "3:20",
    thumbnailUrl: "/thumb-1.jpg",
    isParentRecommended: true,
    parentRecommendedAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
    channel: { id: "channel-1", name: "동물 친구들" },
    tags: [{ id: "tag-1", name: "자연", slug: "nature", color: null, icon: null }],
  },
  {
    id: "video-2",
    youtubeVideoId: "lmnopqrstuv",
    title: "종이접기 놀이",
    description: null,
    searchKeywords: "만들기",
    durationText: null,
    thumbnailUrl: "/thumb-2.jpg",
    isParentRecommended: false,
    parentRecommendedAt: null,
    updatedAt: "2026-08-29T00:00:00.000Z",
    channel: { id: "channel-2", name: "손으로 만들어요" },
    tags: [{ id: "tag-2", name: "미술", slug: "art", color: null, icon: null }],
  },
];

describe("filterAppCatalogVideos", () => {
  it("searches titles, parent keywords, and tag names", () => {
    expect(filterAppCatalogVideos(videos, "동물", "").map(({ id }) => id)).toEqual([
      "video-1",
    ]);
    expect(filterAppCatalogVideos(videos, "코끼리", "").map(({ id }) => id)).toEqual([
      "video-1",
    ]);
    expect(filterAppCatalogVideos(videos, "미술", "").map(({ id }) => id)).toEqual([
      "video-2",
    ]);
  });

  it("does not expose administrator descriptions through child search", () => {
    expect(filterAppCatalogVideos(videos, "비밀단어", "")).toEqual([]);
  });

  it("combines tag and channel filters within the approved catalog", () => {
    expect(filterAppCatalogVideos(videos, "", "nature", "channel-1")).toEqual([
      videos[0],
    ]);
    expect(filterAppCatalogVideos(videos, "", "nature", "channel-2")).toEqual([]);
  });
});
