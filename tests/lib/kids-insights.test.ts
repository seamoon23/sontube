import { describe, expect, it } from "vitest";
import {
  buildKidsInsightPrompt,
  getKidsInsightPeriod,
  summarizeKidsSignals,
} from "@/lib/kids-insights";

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

  it("mentions the selected summary period", () => {
    const prompt = buildKidsInsightPrompt(summarizeKidsSignals(records), {
      periodLabel: "최근 7일",
    });

    expect(prompt).toContain("요약 기간: 최근 7일");
  });
});

describe("getKidsInsightPeriod", () => {
  it("supports 7 day, 30 day, and all-time summaries", () => {
    const now = new Date("2026-07-03T00:00:00.000Z");

    expect(getKidsInsightPeriod("7d", now)).toEqual({
      value: "7d",
      label: "최근 7일",
      since: new Date("2026-06-26T00:00:00.000Z"),
    });
    expect(getKidsInsightPeriod("30d", now)).toEqual({
      value: "30d",
      label: "최근 30일",
      since: new Date("2026-06-03T00:00:00.000Z"),
    });
    expect(getKidsInsightPeriod("all", now)).toEqual({
      value: "all",
      label: "전체",
      since: null,
    });
  });

  it("falls back to all time for unknown values", () => {
    expect(getKidsInsightPeriod("forever", new Date("2026-07-03T00:00:00.000Z"))).toEqual({
      value: "all",
      label: "전체",
      since: null,
    });
  });
});
