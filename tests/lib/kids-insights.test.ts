import { describe, expect, it } from "vitest";
import { buildKidsInsightPrompt, summarizeKidsSignals } from "@/lib/kids-insights";

const records = [
  {
    type: "LIKE",
    video: {
      id: "video-1",
      title: "고양이 영어 놀이",
      searchKeywords: "고양이, 영어, 동물",
      tags: ["동물", "영어"],
    },
  },
  {
    type: "CURIOUS",
    video: {
      id: "video-1",
      title: "고양이 영어 놀이",
      searchKeywords: "고양이, 영어, 동물",
      tags: ["동물", "영어"],
    },
  },
  {
    type: "PLAYLIST",
    video: {
      id: "video-2",
      title: "화산 과학 실험",
      searchKeywords: "과학, 실험, 화산",
      tags: ["과학"],
    },
  },
] as const;

describe("summarizeKidsSignals", () => {
  it("summarizes signal counts, top videos, keywords, and tags", () => {
    const summary = summarizeKidsSignals(records);

    expect(summary.totalSignals).toBe(3);
    expect(summary.signalCounts).toEqual({
      LIKE: 1,
      CURIOUS: 1,
      PLAYLIST: 1,
    });
    expect(summary.topVideos[0]).toEqual({
      id: "video-1",
      title: "고양이 영어 놀이",
      count: 2,
    });
    expect(summary.topKeywords.slice(0, 2)).toEqual([
      { label: "고양이", count: 2 },
      { label: "영어", count: 2 },
    ]);
    expect(summary.topTags[0]).toEqual({ label: "동물", count: 2 });
  });
});

describe("buildKidsInsightPrompt", () => {
  it("creates an AI prompt that can be copied without exposing child identifiers", () => {
    const prompt = buildKidsInsightPrompt(summarizeKidsSignals(records));

    expect(prompt).toContain("고양이 영어 놀이");
    expect(prompt).toContain("화산 과학 실험");
    expect(prompt).toContain("외부 API 없이");
    expect(prompt).not.toContain("client");
    expect(prompt).not.toContain("video-1");
  });
});
