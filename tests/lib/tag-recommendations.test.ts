import { describe, expect, it } from "vitest";
import { recommendTags } from "@/lib/tag-recommendations";

const tags = [
  {
    id: "tag-animals",
    name: "동물",
    slug: "animals",
    usageCount: 7,
    lastUsedAt: new Date("2026-07-01T12:00:00Z"),
    isActive: true,
  },
  {
    id: "tag-science",
    name: "과학",
    slug: "science",
    usageCount: 5,
    lastUsedAt: new Date("2026-06-24T12:00:00Z"),
    isActive: true,
  },
  {
    id: "tag-english",
    name: "영어",
    slug: "english",
    usageCount: 2,
    lastUsedAt: new Date("2026-07-02T12:00:00Z"),
    isActive: true,
  },
  {
    id: "tag-hidden",
    name: "숨김",
    slug: "hidden",
    usageCount: 99,
    lastUsedAt: new Date("2026-07-02T12:00:00Z"),
    isActive: false,
  },
];

const existingVideos = [
  {
    id: "video-1",
    title: "강아지와 고양이 동물 친구들",
    description: "귀여운 동물 관찰",
    tags: [tags[0]],
  },
  {
    id: "video-2",
    title: "재미있는 과학 실험",
    description: "아이와 보는 물 과학",
    tags: [tags[1]],
  },
];

describe("recommendTags", () => {
  it("combines recent, frequent, keyword, and similar-video signals without inactive tags", () => {
    const recommended = recommendTags({
      title: "고양이 영어 단어 놀이",
      description: "동물 이름을 영어로 배워요",
      tags,
      existingVideos,
      now: new Date("2026-07-02T15:00:00Z"),
    });

    expect(recommended.map((tag) => tag.slug)).toEqual(["animals", "english", "science"]);
    expect(recommended.find((tag) => tag.slug === "hidden")).toBeUndefined();
  });

  it("returns hot tags based only on active tag usage and recency when text is empty", () => {
    const recommended = recommendTags({
      title: "",
      description: "",
      tags,
      existingVideos,
      now: new Date("2026-07-02T15:00:00Z"),
      limit: 2,
    });

    expect(recommended.map((tag) => tag.slug)).toEqual(["animals", "english"]);
  });
});
