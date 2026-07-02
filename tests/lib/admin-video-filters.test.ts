import { SafetyStatus, ThumbnailType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildAdminVideoWhere } from "@/lib/admin-video-filters";

describe("buildAdminVideoWhere", () => {
  it("builds a broad internal search across parent-managed fields", () => {
    expect(buildAdminVideoWhere({ q: "cat" })).toEqual({
      OR: [
        { title: { contains: "cat" } },
        { description: { contains: "cat" } },
        { searchKeywords: { contains: "cat" } },
        { youtubeVideoId: { contains: "cat" } },
      ],
    });
  });

  it("filters by tag and safety/publication status", () => {
    expect(buildAdminVideoWhere({ tagId: "tag-1", status: "published" })).toEqual({
      tags: { some: { tagId: "tag-1" } },
      isPublished: true,
      safetyStatus: SafetyStatus.PARENT_CHECKED,
    });

    expect(buildAdminVideoWhere({ status: "review" })).toEqual({
      safetyStatus: SafetyStatus.NEEDS_REVIEW,
    });

    expect(buildAdminVideoWhere({ status: "hidden" })).toEqual({
      safetyStatus: SafetyStatus.HIDDEN,
    });
  });

  it("supports parent recommendation and thumbnail type filters", () => {
    expect(buildAdminVideoWhere({ recommended: "1", thumbnail: "CUSTOM" })).toEqual({
      isParentRecommended: true,
      thumbnailType: ThumbnailType.CUSTOM,
    });
  });

  it("ignores unsupported filter values", () => {
    expect(
      buildAdminVideoWhere({
        q: "  ",
        status: "published;drop",
        recommended: "yes",
        thumbnail: "REMOTE",
      }),
    ).toEqual({});
  });
});
