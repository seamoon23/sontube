import Ajv from "ajv";
import { SafetyStatus, ThumbnailType } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import liteCatalogSchema from "@/contracts/lite-catalog-v1.schema.json";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { video: { findMany: mocks.findMany } },
}));

import { GET } from "@/app/api/lite/catalog/route";
import { LITE_CATALOG_CACHE_CONTROL } from "@/lib/lite-catalog";

const schema = structuredClone(liteCatalogSchema) as Record<string, unknown>;
delete schema.$schema;
const validateContract = new Ajv({ allErrors: true, jsonPointers: true }).compile(schema);

describe("public Lite catalog route contract", () => {
  beforeEach(() => {
    mocks.findMany.mockResolvedValue([
      {
        id: "video-public-1",
        familyId: "family-operator",
        youtubeVideoId: "M7lc1UVf-VE",
        originalUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
        title: "공개 과학 영상",
        description: "빛과 우주를 살펴봅니다.",
        searchKeywords: "과학 우주",
        durationText: "04:20",
        thumbnailType: ThumbnailType.YOUTUBE,
        youtubeThumbnailUrl: "https://img.youtube.com/vi/M7lc1UVf-VE/hqdefault.jpg",
        customThumbnailPath: null,
        safetyStatus: SafetyStatus.PARENT_CHECKED,
        isPublished: true,
        isLitePublished: true,
        liteSortOrder: 10,
        isParentRecommended: false,
        parentRecommendedAt: null,
        playMode: "SINGLE_THEN_CLOSE",
        createdAt: new Date("2026-08-30T00:00:00.000Z"),
        updatedAt: new Date("2026-08-30T01:00:00.000Z"),
        channelId: "channel-public",
        channel: { id: "channel-public", displayName: "호기심 과학" },
        tags: [
          {
            videoId: "video-public-1",
            tagId: "tag-science",
            assignedAt: new Date("2026-08-30T00:00:00.000Z"),
            tag: {
              id: "tag-science",
              familyId: "family-operator",
              name: "과학",
              slug: "science",
              color: "#0369a1",
              icon: null,
              description: null,
              sortOrder: 10,
              isActive: true,
              usageCount: 1,
              lastUsedAt: new Date("2026-08-30T00:00:00.000Z"),
              createdAt: new Date("2026-08-30T00:00:00.000Z"),
              updatedAt: new Date("2026-08-30T00:00:00.000Z"),
            },
          },
        ],
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a schema-conformant public projection with a weak ETag", async () => {
    const response = await GET(new Request("https://sontube.example/api/lite/catalog"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(LITE_CATALOG_CACHE_CONTROL);
    expect(response.headers.get("etag")).toMatch(/^W\/"lite-[a-f0-9]{24}"$/);
    expect(validateContract(body), JSON.stringify(validateContract.errors)).toBe(true);
    expect(JSON.stringify(body)).not.toContain("family-operator");
    expect(JSON.stringify(body)).not.toContain("originalUrl");
  });

  it("returns 304 for a matching weak or strong validator", async () => {
    const first = await GET(new Request("https://sontube.example/api/lite/catalog"));
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();

    const weakResponse = await GET(
      new Request("https://sontube.example/api/lite/catalog", {
        headers: { "if-none-match": etag ?? "" },
      }),
    );
    const strongResponse = await GET(
      new Request("https://sontube.example/api/lite/catalog", {
        headers: { "if-none-match": (etag ?? "").replace(/^W\//, "") },
      }),
    );

    expect(weakResponse.status).toBe(304);
    expect(strongResponse.status).toBe(304);
  });

  it("keeps transient failures private and outside the success contract", async () => {
    mocks.findMany.mockRejectedValueOnce(new Error("temporary database failure"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(new Request("https://sontube.example/api/lite/catalog"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(validateContract(body)).toBe(false);
  });
});
