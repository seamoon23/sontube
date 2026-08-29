import { ThumbnailType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildAppCatalog, createCatalogVersion } from "@/lib/app-catalog";
import { filterAppCatalogVideos } from "@/lib/app-video-filters";

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
          channel: { id: "channel_1", displayName: "Nature Club" },
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
    expect(catalog.version).toMatch(/^[a-f0-9]{24}$/);
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
        channel: { id: "channel_1", name: "Nature Club" },
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

    const regenerated = buildAppCatalog(
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
          channel: { id: "channel_1", displayName: "Nature Club" },
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
      new Date("2026-07-25T00:00:00.000Z"),
    );
    expect(regenerated.version).toBe(catalog.version);

    const renamedChannelVersion = createCatalogVersion([
      { ...catalog.videos[0], channel: { id: "channel_1", name: "Renamed Nature Club" } },
    ]);
    expect(renamedChannelVersion).not.toBe(catalog.version);

    expect(filterAppCatalogVideos(catalog.videos, "animals", "", null)).toHaveLength(1);
    expect(filterAppCatalogVideos(catalog.videos, "Nature Club", "", null)).toHaveLength(0);
    expect(filterAppCatalogVideos(catalog.videos, "", "", "channel_1")).toHaveLength(1);
    expect(filterAppCatalogVideos(catalog.videos, "", "", "another_channel")).toHaveLength(0);
  });
});
