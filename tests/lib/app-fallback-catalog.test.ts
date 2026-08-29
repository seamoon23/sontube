import { describe, expect, it } from "vitest";
import {
  APP_FALLBACK_VIDEOS,
  buildFallbackTags,
  filterFallbackVideos,
} from "@/lib/app-fallback-catalog";

describe("offline app samples", () => {
  it("has enough varied cards for layout and filter QA", () => {
    expect(APP_FALLBACK_VIDEOS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(APP_FALLBACK_VIDEOS.map((video) => video.id)).size).toBe(APP_FALLBACK_VIDEOS.length);
    expect(buildFallbackTags(APP_FALLBACK_VIDEOS).length).toBeGreaterThanOrEqual(8);

    const channelCounts = new Map<string, number>();
    for (const video of APP_FALLBACK_VIDEOS) {
      channelCounts.set(video.channel.id, (channelCounts.get(video.channel.id) ?? 0) + 1);
    }
    expect(channelCounts.size).toBe(3);
    expect(Array.from(channelCounts.values()).every((count) => count >= 2)).toBe(true);
  });

  it("filters samples by query and tag", () => {
    expect(filterFallbackVideos(APP_FALLBACK_VIDEOS, "공룡", "").map((video) => video.id)).toEqual([
      "sample-dinosaur",
    ]);
    expect(filterFallbackVideos(APP_FALLBACK_VIDEOS, "", "animals")).toHaveLength(3);
    expect(filterFallbackVideos(APP_FALLBACK_VIDEOS, "과일", "learning").map((video) => video.id)).toEqual([
      "sample-cooking",
    ]);
  });

  it("filters by channel independently without adding channel names to keyword search", () => {
    expect(filterFallbackVideos(APP_FALLBACK_VIDEOS, "", "", "sample-nature-lab")).toHaveLength(4);
    expect(filterFallbackVideos(APP_FALLBACK_VIDEOS, "호기심 자연 연구소", "")).toHaveLength(0);
  });
});
