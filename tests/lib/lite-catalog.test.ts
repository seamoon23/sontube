import { SafetyStatus, ThumbnailType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { AppCatalogVideoSource } from "@/lib/app-catalog";
import {
  buildLiteCatalog,
  createLiteCatalogEtag,
  LITE_CATALOG_CACHE_CONTROL,
  LITE_CATALOG_VIDEO_ORDER_BY,
  LITE_CATALOG_VIDEO_WHERE,
  matchesLiteCatalogEtag,
} from "@/lib/lite-catalog";

const UPDATED_AT = new Date("2026-08-30T01:00:00.000Z");
const GENERATED_AT = new Date("2026-08-30T02:00:00.000Z");

describe("Lite catalog", () => {
  it("selects only explicitly Lite-published, approved public videos in stable order", () => {
    expect(LITE_CATALOG_VIDEO_WHERE).toEqual({
      isLitePublished: true,
      isPublished: true,
      safetyStatus: SafetyStatus.PARENT_CHECKED,
      family: { is: { isActive: true } },
    });
    expect(LITE_CATALOG_VIDEO_ORDER_BY).toEqual([
      { liteSortOrder: "asc" },
      { updatedAt: "desc" },
      { id: "asc" },
    ]);
  });

  it("builds an AppCatalog-compatible LIVE projection without internal family or URL fields", () => {
    const source = {
      id: "video-1",
      familyId: "family-private",
      originalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      isLitePublished: true,
      liteSortOrder: 3,
      youtubeVideoId: "dQw4w9WgXcQ",
      title: "공개 체험 영상",
      description: "아이에게 표시할 설명",
      searchKeywords: "체험 음악",
      durationText: "03:32",
      thumbnailType: ThumbnailType.YOUTUBE,
      youtubeThumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      customThumbnailPath: null,
      isParentRecommended: true,
      parentRecommendedAt: UPDATED_AT,
      updatedAt: UPDATED_AT,
      channel: { id: "channel-1", displayName: "공개 채널" },
      tags: [
        {
          tag: {
            id: "tag-1",
            name: "음악",
            slug: "music",
            color: "#0369a1",
            icon: null,
          },
        },
      ],
    } as AppCatalogVideoSource & {
      familyId: string;
      originalUrl: string;
      isLitePublished: boolean;
      liteSortOrder: number;
    };

    const catalog = buildLiteCatalog([source], GENERATED_AT);

    expect(catalog.source).toBe("LIVE");
    expect(catalog.generatedAt).toBe(GENERATED_AT.toISOString());
    expect(catalog.version).toMatch(/^[a-f0-9]{24}$/);
    expect(catalog.videos).toEqual([
      {
        id: "video-1",
        youtubeVideoId: "dQw4w9WgXcQ",
        title: "공개 체험 영상",
        description: "아이에게 표시할 설명",
        searchKeywords: "체험 음악",
        durationText: "03:32",
        thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        isParentRecommended: true,
        parentRecommendedAt: UPDATED_AT.toISOString(),
        updatedAt: UPDATED_AT.toISOString(),
        channel: { id: "channel-1", name: "공개 채널" },
        tags: [{ id: "tag-1", name: "음악", slug: "music", color: "#0369a1", icon: null }],
      },
    ]);
    expect(catalog.videos[0]).not.toHaveProperty("familyId");
    expect(catalog.videos[0]).not.toHaveProperty("originalUrl");
    expect(catalog.videos[0]).not.toHaveProperty("isLitePublished");
    expect(catalog.videos[0]).not.toHaveProperty("liteSortOrder");
  });

  it("creates a cacheable ETag and accepts strong, weak, list, and wildcard validators", () => {
    const etag = createLiteCatalogEtag({ version: "abc123" });

    expect(etag).toBe('W/"lite-abc123"');
    expect(matchesLiteCatalogEtag(null, etag)).toBe(false);
    expect(matchesLiteCatalogEtag('"other", "lite-abc123"', etag)).toBe(true);
    expect(matchesLiteCatalogEtag('W/"lite-abc123"', etag)).toBe(true);
    expect(matchesLiteCatalogEtag("*", etag)).toBe(true);
    expect(LITE_CATALOG_CACHE_CONTROL).toBe("public, max-age=0, s-maxage=60, must-revalidate");
  });
});
