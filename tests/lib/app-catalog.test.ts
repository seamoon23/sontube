import { ThumbnailType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildAppCatalog } from "@/lib/app-catalog";

describe("buildAppCatalog", () => {
  it("serializes approved-video data into the app sync JSON shape", () => {
    const catalog = buildAppCatalog(
      [
        {
          id: "video_1",
          youtubeVideoId: "dQw4w9WgXcQ",
          title: "Safe animals",
          description: "Calm animal video",
          searchKeywords: "cat dog nature",
          durationText: "3:21",
          thumbnailType: ThumbnailType.CUSTOM,
          youtubeThumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          customThumbnailPath: "/uploads/thumbnails/custom.webp",
          isParentRecommended: true,
          parentRecommendedAt: new Date("2026-07-23T00:00:00.000Z"),
          updatedAt: new Date("2026-07-22T00:00:00.000Z"),
          tags: [
            {
              tag: {
                id: "tag_1",
                name: "animals",
                slug: "animals",
                color: "#16a34a",
                icon: "paw",
              },
            },
          ],
        },
      ],
      new Date("2026-07-24T00:00:00.000Z"),
    );

    expect(catalog.generatedAt).toBe("2026-07-24T00:00:00.000Z");
    expect(catalog.videos).toEqual([
      {
        id: "video_1",
        youtubeVideoId: "dQw4w9WgXcQ",
        title: "Safe animals",
        description: "Calm animal video",
        searchKeywords: "cat dog nature",
        durationText: "3:21",
        thumbnailUrl: "/uploads/thumbnails/custom.webp",
        isParentRecommended: true,
        parentRecommendedAt: "2026-07-23T00:00:00.000Z",
        updatedAt: "2026-07-22T00:00:00.000Z",
        tags: [
          {
            id: "tag_1",
            name: "animals",
            slug: "animals",
            color: "#16a34a",
            icon: "paw",
          },
        ],
      },
    ]);
    expect(catalog.videos[0]).not.toHaveProperty("originalUrl");
  });
});